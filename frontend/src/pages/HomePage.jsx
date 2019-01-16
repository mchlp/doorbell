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
        };
        this.handleDoorbell = this.handleDoorbell.bind(this);
        this.handleAlarm = this.handleAlarm.bind(this);
        this.handleCheck = this.handleCheck.bind(this);
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

    async handleCheck() {
        if (this.state.occupiedStatus === OccupiedStatus.UNKNOWN) {
            this.setState({
                check: true
            }, async () => {
                const res = await axios.post('/api/check');
                if (res) {
                    this.setState({
                        occupiedStatus: res.data.occupied ? OccupiedStatus.OCCUPIED : OccupiedStatus.UNOCCUPIED,
                        check: false,
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
            alarm: true
        }, async () => {
            await axios.post('/api/alarm');
            this.setState({
                alarm: false
            });
        });
    }

    render() {
        return (
            <div className="container mt-3">
                {localStorage.token ?
                    <div>
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
