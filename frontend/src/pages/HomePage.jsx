import React, { Component } from 'react';
import LoginPage from './LoginPage';
import axios from 'axios';

const OccupiedStatus = {
    UNKNOWN: 0,
    OCCUPIED: 1,
    UNOCCUPIED: 2
};

export default class HomePage extends Component {

    constructor(props) {
        super(props);
        this.state = {
            occupiedStatus: OccupiedStatus.UNKNOWN,
            doorbell: false,
            check: false,
            alarm: false,
            broadcast: false,
            inuse: false,
        };
        this.handleDoorbell = this.handleDoorbell.bind(this);
        this.handleAlarm = this.handleAlarm.bind(this);
        this.handleCheck = this.handleCheck.bind(this);
        this.handleBroadcast = this.handleBroadcast.bind(this);
    }

    async handleDoorbell() {
        this.setState({
            doorbell: true,
            inuse: false
        }, async () => {
            const res = await axios.post('/api/doorbell');
            this.setState({
                doorbell: false,
                inuse: res.data.status === 'in-use'
            });
        });
    }

    async handleCheck() {
        if (this.state.occupiedStatus === OccupiedStatus.UNKNOWN) {
            this.setState({
                check: true,
                inuse: false
            }, async () => {
                const res = await axios.post('/api/check');
                if (res) {
                    this.setState({
                        occupiedStatus: res.data.occupied ? OccupiedStatus.OCCUPIED : OccupiedStatus.UNOCCUPIED,
                        check: false,
                        inuse: res.data.status === 'in-use'
                    });
                }
                setTimeout(() => {
                    this.setState({
                        occupiedStatus: OccupiedStatus.UNKNOWN
                    });
                }, 3000);
            });
        }
    }

    async handleAlarm() {
        this.setState({
            alarm: true,
            inuse: false
        }, async () => {
            const res = await axios.post('/api/alarm');
            this.setState({
                alarm: false,
                inuse: res.data.status === 'in-use'
            });
        });
    }

    async handleBroadcast(e) {
        e.preventDefault();
        this.setState({
            broadcast: true,
            inuse: false
        }, async () => {
            const res = await axios.post('/api/broadcast', {
                message: document.getElementById('broadcast-message').value
            });
            this.setState({
                broadcast: false,
                inuse: res.data.status === 'in-use'
            });
            if (res.data.status === 'success') {
                document.getElementById('broadcast-message').value = '';
            }
        });
    }

    render() {
        return (
            <div className="container mt-3">
                {localStorage.token ?
                    <div>
                        {this.state.inuse ?
                            <div className='alert alert-danger'>
                                Currently in use. Please try again later.
                            </div>
                            :
                            null
                        }
                        <button className="btn btn-primary btn-lg btn-block" onClick={this.handleDoorbell} disabled={this.state.doorbell}>
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
                        <button className={'btn btn-lg btn-block' + (this.state.occupiedStatus === OccupiedStatus.UNKNOWN ? ' btn-primary' : this.state.occupiedStatus === OccupiedStatus.OCCUPIED ? ' btn-success' : ' btn-warning')} onClick={this.handleCheck} disabled={this.state.check}>
                            {this.state.occupiedStatus === OccupiedStatus.UNKNOWN ?
                                this.state.check ?
                                    <div>
                                        <i className='fa fa-circle-o-notch fa-spin mr-2'></i>
                                        Check Occupancy
                                    </div> :
                                    <div>
                                        Check Occupancy
                                    </div>
                                :
                                this.state.occupiedStatus === OccupiedStatus.OCCUPIED ?
                                    <div>
                                        Occupied
                                    </div>
                                    :
                                    <div>
                                        Unoccupied
                                    </div>
                            }
                        </button>
                        <form onSubmit={this.handleBroadcast}>
                            <div className="input-group my-3">
                                <input type="text" id="broadcast-message" className="form-control" placeholder="Enter message to broadcast" required />
                                <div className="input-group-append">
                                    <button className="btn btn-primary" type="submit" disabled={this.state.broadcast}>
                                        {this.state.broadcast ?
                                            <div>
                                                <i className='fa fa-circle-o-notch fa-spin mr-2'></i>
                                                Broadcast
                                            </div> :
                                            <div>
                                                Broadcast
                                            </div>
                                        }
                                    </button>
                                </div>
                            </div>
                        </form>
                        <button className="btn btn-danger btn-lg btn-block" onClick={this.handleAlarm} disabled={this.state.alarm}>
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
