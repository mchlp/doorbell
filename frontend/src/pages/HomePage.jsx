import React, { Component } from 'react';
import LoginPage from './LoginPage';
import axios from 'axios';

export default class HomePage extends Component {

    constructor(props) {
        super(props);
        this.state = {
            doorbell: false,
            tray: false,
            alarm: false
        };
        this.handleDoorbell = this.handleDoorbell.bind(this);
        this.handleCDTray = this.handleCDTray.bind(this);
    }

    async handleDoorbell() {
        this.setState({
            doorbell: true
        }, async () => {
            await axios.post('/api/doorbell');
            this.setState({
                doorbell: false
            });
        });
    }

    async handleCDTray() {
        this.setState({
            tray: true
        }, async () => {
            await axios.post('/api/cdtray');
            this.setState({
                tray: false
            });
        });
    }

    async handleAlarm() {
        this.setState({
            alarm: true
        }, async () => {
            await axios.post('/api/alarm');
            this.setState({
                doorbell: false
            });
        });
    }

    render() {
        return (
            <div className="container mt-3">
                {localStorage.token ?
                    <div>
                        <button className="btn btn-primary btn-lg btn-block" onClick={this.handleDoorbell}>
                            {this.state.doorbell ?
                                <div>
                                    <i className='fa fa-circle-o-notch fa-spin mr-2'></i>
                                    Doorbell
                                </div> :
                                <div>
                                    Doorbell
                                </div>
                            }
                        </button>
                        <button className="btn btn-primary btn-lg btn-block" onClick={this.handleCDTray}>
                            {this.state.tray ?
                                <div>
                                    <i className='fa fa-circle-o-notch fa-spin mr-2'></i>
                                    CD Tray
                                </div> :
                                <div>
                                    CD Tray
                                </div>
                            }
                        </button>
                        <button className="btn btn-danger btn-lg btn-block" onClick={this.handleCDTray}>
                            {this.state.alarm ?
                                <div>
                                    <i className='fa fa-circle-o-notch fa-spin mr-2'></i>
                                    Alarm
                                </div> :
                                <div>
                                    Alarm
                                </div>
                            }
                        </button>
                    </div> :
                    <LoginPage />
                }
            </div>
        );
    }
}
