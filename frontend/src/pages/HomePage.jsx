import React, { Component } from 'react';
import LoginPage from './LoginPage';
import SocketContext from '../socket';
import axios from 'axios';

const occupancyStatusBarColours = {
    unknown: '#E5E5E5',
    occupied: '#1FBA00',
    unoccupied: '#BA0000',
    text: '#000000'
};

class HomePage extends Component {

    constructor(props) {
        super(props);
        this.state = {
            connected: false,
            loggedin: false,
            occupied: false,
            doorbell: false,
            check: false,
            alarm: false,
            knock: false,
            broadcast: false,
            inuse: false,
            occupancyLog: []
        };

        this.props.socket.on('connect', () => {
            this.setState({
                connected: true
            });
            const token = localStorage.getItem('token');
            if (token) {
                this.props.socket.emit('authenticate', {
                    token: token
                });
                this.props.socket.on('authenticate-reply', (data) => {
                    if (data.status === 'failed') {
                        localStorage.removeItem('token');
                        window.location.reload();
                    }
                });
            }
            this.props.socket.emit('occupancy-check');
        });

        this.props.socket.on('disconnect', () => {
            this.setState({
                connected: false
            });
        });

        this.props.socket.on('occupancy-update', (data) => {
            this.setState({
                occupied: !!data.occupied
            });
        });

        this.props.socket.on('occupancy-log-reply', (data) => {
            this.setState({
                occupancyLog: data
            });
        });

        setInterval(() => {
            this.props.socket.emit('occupancy-log-get');
        }, 1000 * 60);

        this.handleSoundAction = this.handleSoundAction.bind(this);
        this.handleBroadcast = this.handleBroadcast.bind(this);
        this.logout = this.logout.bind(this);
    }

    async logout() {
        await axios.post('/api/logout', {
            token: localStorage.getItem('token')
        });
        localStorage.removeItem('token');
        window.location.reload();
    }

    async handleSoundAction(e) {
        const type = e.currentTarget.getAttribute('type');
        this.setState({
            [type]: true,
            inuse: false
        }, async () => {
            this.props.socket.emit(type);
            this.props.socket.on(type + '-reply', (data) => {
                this.setState({
                    [type]: false,
                    inuse: data.status === 'in-use'
                });
                this.props.socket.off(type + '-reply');
            });
        });
    }

    async handleBroadcast(e) {
        e.preventDefault();
        this.setState({
            broadcast: true,
            inuse: false
        }, async () => {
            this.props.socket.emit('broadcast', {
                message: document.getElementById('broadcast-message').value
            });
            this.props.socket.on('broadcast-reply', (data) => {
                this.setState({
                    broadcast: false,
                    inuse: data.status === 'in-use'
                });
                if (data.status === 'success') {
                    document.getElementById('broadcast-message').value = '';
                }
                this.props.socket.off('broadcast-reply');
            });
        });
    }

    componentDidUpdate() {

        if (localStorage.getItem('token')) {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;

            const ctx = this.canvas.getContext('2d');
            ctx.fillStyle = occupancyStatusBarColours.unknown;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            const now = Date.now();
            for (const log of this.state.occupancyLog) {
                console.log(log.time);
                const barPosition = this.canvas.width - (((now - log.time) / (1000 * 60 * 60 * 24)) * this.canvas.width);
                if (log.status) {
                    ctx.fillStyle = occupancyStatusBarColours.occupied;
                    ctx.fillRect(barPosition, 0, this.canvas.width - barPosition, 20);
                } else {
                    ctx.fillStyle = occupancyStatusBarColours.unoccupied;
                    ctx.fillRect(barPosition, 0, this.canvas.width - barPosition, 20);
                }
            }

            let hourInterval = new Date(now - (1000 * 60 * 60 * 24));
            hourInterval.setMinutes(0, 0);
            ctx.font = '11px Calibri';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = 0; i <= 24; i += 3) {
                ctx.fillStyle = occupancyStatusBarColours.text;
                const xPos = this.canvas.width - ((-(hourInterval.valueOf() - now)) / (1000 * 60 * 60 * 24) * this.canvas.width);
                const rawHours = hourInterval.getHours();
                const text = rawHours > 12 ? rawHours - 12 + ' PM' : rawHours + ' AM';
                ctx.fillText(text, xPos, 30);
                hourInterval = new Date(hourInterval.valueOf() + (3 * 1000 * 60 * 60));
            }
        }
    }

    render() {
        return (
            <div className="container mt-3">
                {localStorage.getItem('token') ?
                    <div>
                        {this.state.inuse ?
                            <div className='alert alert-danger'>
                                Currently in use. Please try again later.
                            </div>
                            :
                            null
                        }
                        <div className={'card text-white bg-primary mb-2' + (this.state.connected ? ' bg-success' : ' bg-danger')}>
                            <div className="card-body">
                                <h5 className="card-text text-center">
                                    {this.state.connected ?
                                        <div>
                                            <b>Status:</b> Connected
                                        </div> :
                                        <div>
                                            <b>Status:</b> Not Connected
                                        </div>
                                    }
                                </h5>
                            </div>
                        </div>
                        <div className={'card bg-primary mb-2' + (!this.state.connected ? ' bg-danger text-white' : this.state.occupied ? ' bg-success text-white' : ' bg-warning text-black')}>
                            <div className="card-body">
                                <h5 className="card-text text-center">
                                    {this.state.connected ?
                                        this.state.occupied ?
                                            <div>
                                                <b>Occupancy:</b> Occupied
                                            </div>
                                            :
                                            <div>
                                                <b>Occupancy:</b> Unoccupied
                                            </div>
                                        :
                                        <div>
                                            <b>Occupancy:</b> Unknown
                                        </div>
                                    }
                                </h5>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-lg btn-block" type='doorbell' onClick={this.handleSoundAction} disabled={this.state.doorbell || !this.state.connected}>
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
                        <button className="btn btn-secondary btn-lg btn-block" type='knock' onClick={this.handleSoundAction} disabled={this.state.knock || !this.state.connected}>
                            {this.state.knock ?
                                <div>
                                    <i className='fa fa-circle-o-notch fa-spin mr-2'></i>
                                    Knock Knock
                                </div> :
                                <div>
                                    Knock Knock
                                </div>
                            }
                        </button>
                        <form onSubmit={this.handleBroadcast}>
                            <div className="input-group my-3">
                                <input type="text" id="broadcast-message" className="form-control" placeholder="Enter message to broadcast" required disabled={!this.state.connected} />
                                <div className="input-group-append">
                                    <button className="btn btn-secondary" type="submit" disabled={this.state.broadcast || !this.state.connected}>
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
                        <button className="btn btn-danger btn-lg btn-block" type='alarm' onClick={this.handleSoundAction} disabled={this.state.alarm || !this.state.connected}>
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
                        <div className="card text-black bg-light my-3">
                            <div className="card-header">
                                <h5 className='mb-0'>
                                    Occupancy Log
                                </h5>
                            </div>
                            <canvas width="100%" height="40" ref={ref => this.canvas = ref}></canvas>
                            <div className="card-body">
                                {
                                    this.state.occupancyLog.length ?
                                        this.state.occupancyLog.map((log) => {
                                            return (
                                                log.time !== 0 ?
                                                    <p key={log.time} className="card-text">
                                                        <b>{
                                                            (new Date(log.time)).toLocaleString('en-US') + ' - '}
                                                        </b>
                                                        {(log.status ? 'Occupied' : 'Unoccupied')}
                                                    </p>
                                                    :
                                                    null
                                            );
                                        })
                                        :
                                        <p>No logs found.</p>
                                }
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-lg btn-block mb-3" onClick={this.logout}>
                            Logout
                        </button>
                    </div> :
                    <LoginPage />
                }
            </div>
        );
    }
}

const wrappedHomePage = (props) => (
    <SocketContext.Consumer>
        {socket => <HomePage {...props} socket={socket} />}
    </SocketContext.Consumer>
);

export default wrappedHomePage;
