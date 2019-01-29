import React, { Component } from 'react';
import LoginPage from './LoginPage';
import SocketContext from '../socket';
import axios from 'axios';

const occupancyStatusBarColours = {
    unknown: '#fcfcfc',
    occupied: '#06d117',
    unoccupied: '#fcfcfc',
    lines: 'rgba(0, 0, 0, 0.25)',
    text: '#000000'
};

const occupancyBarConfig = {
    markedIntervals: [3, 6, 9, 12]
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
            occupancyLog: [],
            occupancyBar: {
                startAtNow: true,
                startTime: null
            }
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
            this.props.socket.emit('occupancy-log-get');
        });

        this.props.socket.on('occupancy-log-reply', (data) => {
            if (this.state.occupancyBar.startAtNow) {
                this.setState((prevState) => {
                    return {
                        occupancyBar: {
                            ...prevState.occupancyBar,
                            startTime: Date.now()
                        },
                        occupancyLog: data
                    };
                });
            } else {
                this.setState({
                    occupancyLog: data
                });
            }
        });

        setInterval(() => {
            this.props.socket.emit('occupancy-log-get');
        }, 1000 * 60);

        this.handleSoundAction = this.handleSoundAction.bind(this);
        this.handleBroadcast = this.handleBroadcast.bind(this);
        this.updateOccupancyBar = this.updateOccupancyBar.bind(this);
        this.scrollOccupancyBar = this.scrollOccupancyBar.bind(this);
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

    scrollOccupancyBar(move) {
        const scrollMovement = 1000 * 60 * 60;
        const now = Date.now();
        let startAtNow = false;
        let oldStartTime = this.state.occupancyBar.startTime;
        let newStartTime;
        newStartTime = oldStartTime + (scrollMovement * move);
        if (newStartTime > now) {
            newStartTime = now;
            startAtNow = true;
        }
        this.setState({
            occupancyBar: {
                startAtNow,
                startTime: newStartTime
            },
        });
    }

    updateOccupancyBar() {
        const canvasDimensions = this.canvas.getBoundingClientRect();
        const canvasWidth = canvasDimensions.width;
        const canvasHeight = canvasDimensions.height;

        const scale = window.devicePixelRatio || 1;
        this.canvas.width = canvasWidth * scale;
        this.canvas.height = canvasHeight * scale;

        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';

        const ctx = this.canvas.getContext('2d');
        ctx.scale(scale, scale);

        ctx.fillStyle = occupancyStatusBarColours.unknown;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const startTime = this.state.occupancyBar.startTime;
        for (const log of this.state.occupancyLog) {
            const barPosition = canvasWidth - (((startTime - log.time) / (1000 * 60 * 60 * 24)) * canvasWidth);
            if (log.status) {
                ctx.fillStyle = occupancyStatusBarColours.occupied;
                ctx.fillRect(barPosition + 0.5, 0, canvasWidth - barPosition, 20);
            } else {
                ctx.fillStyle = occupancyStatusBarColours.unoccupied;
                ctx.fillRect(barPosition + 0.5, 0, canvasWidth - barPosition, 20);
            }
        }

        let hourInterval = new Date(startTime - (1000 * 60 * 60 * 24));
        hourInterval.setMinutes(0, 0);
        ctx.font = '11px Calibri';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= 24; i++) {

            const rawHours = hourInterval.getHours();

            let hourNum = rawHours > 12 ? rawHours - 12 : rawHours;
            if (hourNum === 0) {
                hourNum = 12;
            }

            if (occupancyBarConfig.markedIntervals.includes(hourNum)) {
                ctx.fillStyle = occupancyStatusBarColours.text;
                const xPos = canvasWidth - ((-(hourInterval.valueOf() - startTime)) / (1000 * 60 * 60 * 24) * canvasWidth);
                let text;
                text = rawHours > 12 ? hourNum + ' PM' : hourNum + ' AM';
                if (xPos > 0 && xPos < canvasWidth) {
                    if ((xPos - ctx.measureText(text).width / 2) < 0) {
                        ctx.textAlign = 'left';
                        ctx.fillText(text, 2, 30);
                    } else if ((xPos + ctx.measureText(text).width / 2) > canvasWidth) {
                        ctx.textAlign = 'right';
                        ctx.fillText(text, canvasWidth - 2, 30);
                    } else {
                        ctx.textAlign = 'center';
                        ctx.fillText(text, xPos, 30);
                    }
                }
                ctx.strokeStyle = occupancyStatusBarColours.lines;
                ctx.beginPath();
                ctx.moveTo(xPos, 0);
                ctx.lineTo(xPos, 20);
                ctx.stroke();
            }

            hourInterval = new Date(hourInterval.valueOf() + (1000 * 60 * 60));
        }

        ctx.fillStyle = occupancyStatusBarColours.text;
        ctx.textAlign = 'center';
        ctx.fillText(new Date(startTime).toDateString(), canvasWidth/2, 50);
    }

    componentDidUpdate() {
        if (localStorage.getItem('token')) {
            this.updateOccupancyBar();
        }
    }

    componentDidMount() {
        if (localStorage.getItem('token')) {
            this.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.scrollOccupancyBar(e.deltaY > 0 ? 1 : -1);
            });
            this.canvas.addEventListener('touchstart', (e) => {
                this.lastTouchX = e.touches[0].clientX;
            });
            this.canvas.addEventListener('touchmove', (e) => {
                const curTouchX = e.touches[0].clientX;
                this.scrollOccupancyBar((this.lastTouchX - curTouchX) / 10);
                this.lastTouchX = curTouchX;
            });
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
                            <canvas className='m-1 border' width="100%" height="60" ref={ref => this.canvas = ref}></canvas>
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
