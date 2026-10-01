"""Regression checks for the native commands that previously broke the bridge."""
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'adapters'))
from audacity_commands import gain_commands, linear_gain_commands, prepare_gains, speed_command, fade_commands


class AudacityCommands(unittest.TestCase):
    def test_speed_uses_current_native_identifier_and_percent_units(self):
        for factor, percent in [(0.75, -25), (1, 0), (1.5, 50)]:
            with self.subTest(factor=factor):
                name, value = speed_command(factor).split(' Percentage=')
                self.assertEqual(name, 'ChangeSpeedAndPitch:')
                self.assertEqual(float(value), percent)

    def test_fades_select_audio_inside_the_project(self):
        self.assertEqual(fade_commands('in', 24000, 48000),
                         ['SelectTime: Start=0 End=0.5 RelativeTo=ProjectStart', 'FadeIn:'])
        self.assertEqual(fade_commands('out', 24000, 48000),
                         ['SelectTime: Start=0.5 End=0 RelativeTo=ProjectEnd', 'FadeOut:'])

    def test_large_gains_preserve_gain_without_exceeding_native_bounds(self):
        for db in [-120, -60, -50, -6, 0, 6, 50, 60, 120]:
            with self.subTest(db=db):
                ratios = []
                for text in gain_commands(db):
                    name, value = text.split(' Ratio=')
                    self.assertEqual(name, 'Amplify:')
                    ratio = float(value)
                    self.assertGreater(ratio, 0.003162)
                    self.assertLess(ratio, 316.227766)
                    ratios.append(ratio)
                self.assertTrue(math.isclose(math.prod(ratios), 10**(db/20), rel_tol=1e-12))
                if abs(db) >= 50:
                    self.assertGreater(len(ratios), 1)

    def test_current_linear_gain_commands_remain_identical(self):
        for value, expected in [
            (-1, ['Invert:']), (0, ['Silence:']),
            (0.25, ['Amplify: Ratio=0.25 AllowClipping=1']),
            (0.5, ['Amplify: Ratio=0.5 AllowClipping=1']),
            (1, ['Amplify: Ratio=1 AllowClipping=1']),
        ]:
            with self.subTest(value=value):
                self.assertEqual(linear_gain_commands(value), expected)

    def test_signed_linear_gain_preserves_product_and_native_bounds(self):
        for value in [0, 1, -1, -.25, .001, -.001, 1000, -1000, 1e-200, -1e200,
                      0.0031620000954717398, 316.2277526855469]:
            with self.subTest(value=value):
                product = 1
                for text in linear_gain_commands(value):
                    if text == 'Silence:':
                        product = 0
                    elif text == 'Invert:':
                        product *= -1
                    else:
                        self.assertTrue(text.startswith('Amplify: Ratio='))
                        self.assertTrue(text.endswith(' AllowClipping=1'))
                        ratio = float(text.split('Ratio=')[1].split()[0])
                        self.assertGreaterEqual(ratio, 0.0031620000954717398)
                        self.assertLessEqual(ratio, 316.2277526855469)
                        product *= ratio
                self.assertTrue(math.isclose(product, value, rel_tol=1e-12))

    def test_invalid_gains_are_rejected_before_commands_are_returned(self):
        for value in [math.nan, math.inf, -math.inf, None, '0.5', True, 10**1000]:
            for builder in [linear_gain_commands, gain_commands]:
                with self.subTest(value=repr(value), builder=builder.__name__):
                    with self.assertRaisesRegex(ValueError, 'finite number'):
                        builder(value)

    def test_gain_plan_validates_the_whole_sequence_before_execution(self):
        for op, key in [('gain', 'value'), ('gain-db', 'db')]:
            with self.subTest(op=op):
                with self.assertRaises(ValueError):
                    prepare_gains([{'op': 'gain', 'value': .5}, {'op': op, key: math.inf}])
        self.assertEqual(prepare_gains([{'op': 'reverse'}, {'op': 'gain', 'value': -.25}]),
                         {1: ['Invert:', 'Amplify: Ratio=0.25 AllowClipping=1']})


if __name__ == '__main__':
    unittest.main()
