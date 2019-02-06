#!/bin/bash

cd frontend
npm run build
rsync ./build/* alpha:/srv/doorbell/frontend -avz --delete-after
cd ../backend
rsync . alpha:/srv/doorbell/backend -avz --exclude 'node_modules' --exclude '**/config.json' --exclude '**/tokens.json' --exclude '**/motionLog.json'
ssh alpha "cd /srv/doorbell/backend; npm install; sudo systemctl restart doorbell"
