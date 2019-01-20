#!/bin/bash

cd frontend
npm run build
rsync ./build/* alpha:/srv/doorbell/frontend -avz --delete-after
cd ../backend
rsync . alpha:/srv/doorbell/backend -avz --exclude 'node_modules' --exclude '*/config.json'
ssh alpha "cd /srv/doorbell/backend; npm install; cd actions; gcc traystatus.c -o traystatus; sudo systemctl restart doorbell"
