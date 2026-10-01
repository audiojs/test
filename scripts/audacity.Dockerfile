FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
    audacity xvfb xauth nodejs python3 python3-numpy python3-soundfile \
    && rm -rf /var/lib/apt/lists/*
ENV CI=true AUDIO_TEST_PYTHON=/usr/bin/python3
WORKDIR /workspace
CMD ["node", "scripts/audacity-ci.js"]
