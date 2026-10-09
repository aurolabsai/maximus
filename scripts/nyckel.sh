#!/bin/sh
# Nyckeln till den körande MAXIMUS-servern.
#
# Servern släpper inte in någon utan den, inte heller den som startat den.
# Skalet läser filen; det här skriptet gör detsamma åt den som provar
# från terminalen:
#
#     curl -H "X-Maximus-Nyckel: $(scripts/nyckel.sh)" http://127.0.0.1:3261/api/uppstart
cat "${MAXIMUS_DATA:-$HOME/Library/Application Support/Maximus}/nyckel"
