import React, { Component } from 'react';
import LoginPage from './LoginPage';
import axios from 'axios';

export default class HomePage extends Component {

    async handleDoorbell() {
        await axios.post('/api/doorbell');
    }

    async handleCDTray() {
        await axios.post('/api/cdtray');
    }

    render() {
        return (
            <div className="container mt-3">
                {localStorage.token ?
                    <div>
                        <button className="btn btn-primary btn-lg btn-block" onClick={this.handleDoorbell}>Doorbell</button>
                        <button className="btn btn-primary btn-lg btn-block" onClick={this.handleCDTray}>CD Tray</button>
                    </div> :
                    <LoginPage />
                }
            </div>
        );
    }
}
