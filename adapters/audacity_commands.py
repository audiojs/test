"""Native Audacity command arguments; no audio processing happens here."""
import math

# Amplify.h stores these limits as float32, then compares double parameters.
AMPLIFY_MIN = 0.0031620000954717398
AMPLIFY_MAX = 316.2277526855469


def finite_gain(value):
    try:
        valid = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    except OverflowError:
        valid = False
    if not valid:
        raise ValueError('Gain must be a finite number')


def gain_commands(db):
    finite_gain(db)
    # Stay strictly inside Amplify's +/-50 dB bounds, whose ratio limits are
    # stored as floats. Split larger changes into equivalent native calls.
    count = int(abs(db)//50)+1
    ratio = 10**(db/count/20)
    return [f'Amplify: Ratio={ratio}']*count


def linear_gain_commands(value):
    finite_gain(value)
    if value == 0:
        return ['Silence:']
    commands = ['Invert:'] if value < 0 else []
    if value == -1:
        return commands
    ratio = abs(value)
    if AMPLIFY_MIN <= ratio <= AMPLIFY_MAX:
        return commands+[f'Amplify: Ratio={ratio} AllowClipping=1']
    return commands+[text+' AllowClipping=1' for text in gain_commands(20*math.log10(ratio))]


def prepare_gains(steps):
    """Validate every gain before the bridge sends any session commands."""
    commands = {}
    for index, step in enumerate(steps):
        if step['op'] == 'gain':
            commands[index] = linear_gain_commands(step['value'])
        elif step['op'] == 'gain-db':
            commands[index] = gain_commands(step['db'])
    return commands


def speed_command(factor):
    return f'ChangeSpeedAndPitch: Percentage={(factor-1)*100}'


def fade_commands(direction, length, sample_rate):
    duration = length/sample_rate
    if direction == 'in':
        return [f'SelectTime: Start=0 End={duration} RelativeTo=ProjectStart', 'FadeIn:']
    # Audacity subtracts ProjectEnd-relative offsets from the project end.
    return [f'SelectTime: Start={duration} End=0 RelativeTo=ProjectEnd', 'FadeOut:']
