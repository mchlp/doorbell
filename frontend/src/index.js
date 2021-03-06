import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import * as serviceWorker from './serviceWorker';
import axios from 'axios';

axios.interceptors.request.use((config) => {
    let newConfig = config;
    newConfig.headers = {
        'Authorization': localStorage.getItem('token')
    };
    return newConfig;
}, (error) => {
    return Promise.reject(error);
});

axios.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response.status) {
        if (error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('perms');
            window.location.reload();
        }
    }
});

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    e.prompt();
});

ReactDOM.render(<App />, document.getElementById('root'));

serviceWorker.register({
    skipWaiting: true,
    clientsClaim: true
});

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.register();
