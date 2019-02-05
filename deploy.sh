#!/bin/bash

cd client
npm run build
rsync ./build/* alpha:/srv/doorbell/client -avz --delete-after
cd ../backend
rsync . alpha:/srv/doorbell/backend -avz --exclude 'node_modules' --exclude '**/config.json' --exclude '**/tokens.json' --exclude '**/motionLog.json'
ssh alpha "cd /srv/doorbell/backend; npm install; cd actions; gcc traystatus.c -o traystatus; sudo systemctl restart doorbell"
