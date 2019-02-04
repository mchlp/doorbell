import React, { Component } from 'react';
import LoginPage from './LoginPage';
import SocketContext from '../socket';
import axios from 'axios';
import SunCalc from 'suncalc';
import moment from 'moment';

const occupancyBarConfig = {
    colours: {
        unknown: '#fcfcfc',
        occupied: '#06d117',
        unoccupied: '#fcfcfc',
        nightlines: '#d1c892',
        daylines: 'rgba(119, 119, 119, 0.7)',
        text: '#000000',
        night: '#222222',
        day: '#c1e3f4',
        school: '#a1bcc9',
    },
    font: {
        hourLabel: 'Segoe UI 11',
        dayLabel: 'Segoe UI 12'
    },
    thickness: {
        hourInterval: 1,
        dayInterval: 2
    },
    markedIntervals: [3, 6, 9, 12, 15, 18, 21, 24],
    schoolHours: {
        start: 8.75,
        end: 15
    },
    location: {
        lat: 43.735970,
        lon: -79.339280
    }
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
            actionLog: [],
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

        this.props.socket.on('action-log-reply', (data) => {
            this.setState({
                actionLog: data
            });
        });

        setInterval(() => {
            this.props.socket.emit('occupancy-log-get');
        }, 1000 * 60);
    }

    logout = async () => {
        await axios.post('/api/logout', {
            token: localStorage.getItem('token')
        });
        localStorage.removeItem('token');
        window.location.reload();
    }

    handleSoundAction = async (e) => {
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

    handleBroadcast = async (e) => {
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

    scrollOccupancyBar = (move) => {
        const scrollMovement = 1000 * 60 * 15;
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

    updateOccupancyBar = () => {

        const canvasDimensions = this.canvasContainer.getBoundingClientRect();
        const canvasWidth = canvasDimensions.width;
        const canvasHeight = canvasDimensions.height;

        const scale = window.devicePixelRatio || 1;
        this.canvas.width = canvasWidth * scale;
        this.canvas.height = canvasHeight * scale;

        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';

        const ctx = this.canvas.getContext('2d');
        ctx.scale(scale, scale);

        // draw background
        ctx.fillStyle = occupancyBarConfig.colours.unknown;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        const startTime = this.state.occupancyBar.startTime;



        // draw nighttime and day background
        for (let i = 0; i < 3; i++) {

            const checkNightDate = new Date(startTime - (1000 * 60 * 60 * 24 * i));
            const checkDayDate = new Date(startTime - (1000 * 60 * 60 * 24 * (i - 1)));

            const sunNightTimes = SunCalc.getTimes(checkNightDate, occupancyBarConfig.location.lat, occupancyBarConfig.location.lon);
            const sunDayTimes = SunCalc.getTimes(checkDayDate, occupancyBarConfig.location.lat, occupancyBarConfig.location.lon);

            const sunRiseTime = sunDayTimes.sunrise;
            const sunSetTime = sunNightTimes.sunset;

            let nightStartX = canvasWidth - (((startTime - sunRiseTime) / (1000 * 60 * 60 * 24)) * canvasWidth);
            let nightEndX = canvasWidth - (((startTime - sunSetTime) / (1000 * 60 * 60 * 24)) * canvasWidth);

            let nightWidth = nightEndX - nightStartX;

            if (nightStartX < 0 && nightEndX > 0) {
                nightStartX = 0;
            }

            ctx.fillStyle = occupancyBarConfig.colours.night;
            ctx.fillRect(nightStartX, 0, nightWidth, 20);
            ctx.fillStyle = occupancyBarConfig.colours.day;
            ctx.fillRect(nightEndX, 0, nightWidth, 20);
        }

        // draw school time background
        ctx.fillStyle = occupancyBarConfig.colours.school;
        const schoolStartHours = Math.floor(occupancyBarConfig.schoolHours.start);
        const schoolStartMinutes = (occupancyBarConfig.schoolHours.start - schoolStartHours) * 60;
        const schoolEndHours = Math.floor(occupancyBarConfig.schoolHours.end);
        const schoolEndMinutes = (occupancyBarConfig.schoolHours.end - schoolEndHours) * 60;

        for (let i = 0; i < 2; i++) {
            let schoolStart = new Date(startTime - (1000 * 60 * 60 * 24 * i)).setHours(schoolStartHours, schoolStartMinutes, 0);
            let schoolEnd = new Date(startTime - (1000 * 60 * 60 * 24 * i)).setHours(schoolEndHours, schoolEndMinutes, 0);

            let schoolStartX = canvasWidth - (((startTime - schoolStart) / (1000 * 60 * 60 * 24)) * canvasWidth);
            let schoolEndX = canvasWidth - (((startTime - schoolEnd) / (1000 * 60 * 60 * 24)) * canvasWidth);

            if (schoolStartX < 0 && schoolEndX > 0) {
                schoolStartX = 0;
            }

            let schoolWidth = schoolEndX - schoolStartX;

            ctx.fillRect(schoolStartX, 0, schoolWidth, 20);
        }

        // drawing occupancy fill
        for (let i = 0; i < this.state.occupancyLog.length; i++) {
            const curLog = this.state.occupancyLog[i];
            if (curLog.occupied) {
                const barStartPosition = canvasWidth - (((startTime - curLog.unixtime) / (1000 * 60 * 60 * 24)) * canvasWidth);
                let barEndPosition = canvasWidth;
                for (let j = i + 1; j < this.state.occupancyLog.length; j++) {
                    const nextLog = this.state.occupancyLog[j];
                    if (!nextLog.occupied) {
                        barEndPosition = canvasWidth - (((startTime - nextLog.unixtime) / (1000 * 60 * 60 * 24)) * canvasWidth);
                        i = j;
                        break;
                    }
                }

                const width = barEndPosition - barStartPosition;
                ctx.fillStyle = occupancyBarConfig.colours.occupied;
                ctx.fillRect(barStartPosition, 0, width, 20);
            }
        }

        // draw hour interval lines
        let hourInterval = new Date(startTime - (1000 * 60 * 60 * 24));
        hourInterval.setMinutes(0, 0);
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= 24; i++) {

            const rawHours = hourInterval.getHours();

            let hourNum = rawHours > 12 ? rawHours - 12 : rawHours;
            if (hourNum === 0) {
                hourNum = 24;
            }

            if (occupancyBarConfig.markedIntervals.includes(hourNum)) {
                ctx.fillStyle = occupancyBarConfig.colours.text;
                const xPos = canvasWidth - ((-(hourInterval.valueOf() - startTime)) / (1000 * 60 * 60 * 24) * canvasWidth);
                let text;
                text = rawHours >= 12 ? hourNum + ' PM' : hourNum + ' AM';
                if (hourNum === 24) {
                    text = '12 AM';
                    ctx.lineWidth = occupancyBarConfig.thickness.dayInterval;
                } else {
                    ctx.lineWidth = occupancyBarConfig.thickness.hourInterval;
                }
                ctx.font = occupancyBarConfig.font.hourLabel;

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

                const sunTimes = SunCalc.getTimes(hourInterval, occupancyBarConfig.location.lat, occupancyBarConfig.location.lon);

                const sunRiseTime = sunTimes.sunrise;
                const sunSetTime = sunTimes.sunset;

                if (hourInterval.valueOf() > sunRiseTime.valueOf() && hourInterval.valueOf() < sunSetTime.valueOf()) {
                    ctx.strokeStyle = occupancyBarConfig.colours.daylines;
                } else {
                    ctx.strokeStyle = occupancyBarConfig.colours.nightlines;
                }

                ctx.beginPath();
                ctx.moveTo(xPos, 0);
                ctx.lineTo(xPos, 20);
                ctx.stroke();
            }

            hourInterval = new Date(hourInterval.valueOf() + (1000 * 60 * 60));
        }

        // draw date
        for (let i = 0; i < 3; i++) {
            const drawDate = new Date(startTime - (1000 * 60 * 60 * 24 * i));
            drawDate.setHours(12, 0, 0);
            let drawPos = canvasWidth - (((startTime - drawDate) / (1000 * 60 * 60 * 24)) * canvasWidth);

            ctx.fillStyle = occupancyBarConfig.colours.text;
            ctx.font = occupancyBarConfig.font.dayLabel;

            const drawText = drawDate.toDateString();
            const leftDrawPos = drawPos - (ctx.measureText(drawText).width / 2);
            const rightDrawPos = drawPos + (ctx.measureText(drawText).width / 2);

            const textPadding = 2;

            if (leftDrawPos < textPadding && rightDrawPos > textPadding) {
                ctx.textAlign = 'left';
                drawPos = textPadding;
            } else if (rightDrawPos > (canvasWidth - textPadding) && leftDrawPos < canvasWidth - textPadding) {
                ctx.textAlign = 'right';
                drawPos = canvasWidth - textPadding;
            } else {
                ctx.textAlign = 'center';
            }
            ctx.fillText(drawText, drawPos, 50);
        }

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
                this.scrollOccupancyBar(e.deltaY > 0 ? 5 : -5);
            });
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.lastTouchX = e.touches[0].clientX;
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const curTouchX = e.touches[0].clientX;
                this.scrollOccupancyBar((this.lastTouchX - curTouchX) / 10);
                this.lastTouchX = curTouchX;
            });
            this.canvas.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.lastTouchX = e.clientX;

                const canvasMouseMoveListener = (e) => {
                    const curTouchX = e.clientX;
                    this.scrollOccupancyBar((this.lastTouchX - curTouchX) / 10);
                    this.lastTouchX = curTouchX;
                };

                const canvasMouseUpListener = () => {
                    removeCanvasListener();
                };

                const canvasMouseLeaveListener = () => {
                    removeCanvasListener();
                };

                const removeCanvasListener = () => {
                    window.removeEventListener('mousemove', canvasMouseMoveListener, true);
                    window.removeEventListener('mouseup', canvasMouseUpListener, true);
                    window.removeEventListener('mouseleave', canvasMouseLeaveListener, true);
                };

                window.addEventListener('mousemove', canvasMouseMoveListener, true);
                window.addEventListener('mouseup', canvasMouseUpListener, true);
                window.addEventListener('mouseleave', canvasMouseLeaveListener, true);

            });

            window.addEventListener('resize', () => {
                this.forceUpdate();
            });
        }
    }

    render() {

        let occupancyLogBody = <p>No logs found.</p>;

        const dateFormat = 'dddd, MMMM Do, YYYY';
        const timeFormat = 'h:mm:ss A';

        if (this.state.occupancyLog.length) {
            const occupancyLog = this.state.occupancyLog;
            let occupancyLogRows = [];
            let occupancyLogRowsDates = [];
            let lastOccupied = null;
            for (let i = 0; i < occupancyLog.length; i++) {

                let log = occupancyLog[i];

                if (log.occupied) {
                    if (lastOccupied === null) {
                        lastOccupied = log;
                    }
                } else {
                    if (lastOccupied) {
                        let next = null;
                        for (let j = i + 1; j < occupancyLog.length; j++) {
                            let checkLog = occupancyLog[j];
                            if (checkLog.occupied) {
                                next = checkLog;
                                break;
                            }
                        }
                        if (!next || next.unixtime - log.unixtime > 1000 * 60 * 5) {
                            occupancyLogRows.push(
                                <tr key={log.unixtime}>
                                    <td>{moment(lastOccupied.unixtime).format(timeFormat)}</td>
                                    <td>{moment(log.unixtime).format(timeFormat)}</td>
                                    <td>{moment.duration(log.unixtime - lastOccupied.unixtime).humanize()}</td>
                                </tr>
                            );
                            occupancyLogRowsDates.push(moment(lastOccupied.unixtime).format(dateFormat));
                            lastOccupied = null;
                        }
                    }
                }
            }

            occupancyLogRows = occupancyLogRows.reverse();
            occupancyLogRowsDates = occupancyLogRowsDates.reverse();

            const occupancyLogTable = [];
            let lastDate = null;
            for (let i = 0; i < occupancyLogRows.length; i++) {
                let row = occupancyLogRows[i];
                let rowDate = occupancyLogRowsDates[i];
                if (lastDate !== rowDate) {
                    occupancyLogTable.push(
                        <tr key={'date-' + rowDate} colSpan="3">
                            <th colSpan="3">{rowDate}</th>
                        </tr>
                    );
                    lastDate = rowDate;
                }
                occupancyLogTable.push(row);
            }

            occupancyLogBody = (
                <table className='table'>
                    <thead>
                        <tr>
                            <th scope='col'>From</th>
                            <th scope='col'>To</th>
                            <th scope='col'>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {occupancyLogTable}
                    </tbody>
                </table>
            );
        }

        let actionLogBody = <p>No logs found.</p>;

        if (this.state.actionLog.length) {

            let actionLog = this.state.actionLog;
            let actionLogRows = [];
            let actionsLogRowsDates = [];
            for (let i = 0; i < actionLog.length; i++) {

                let log = actionLog[i];

                actionLogRows.push(
                    <tr key={log.unixtime}>
                        <td>{moment(log.unixtime).format(timeFormat)}</td>
                        <td>{log.type}</td>
                        <td>{log.message}</td>
                    </tr>
                );
                actionsLogRowsDates.push(moment(log.unixtime).format(dateFormat));
            }

            actionLogRows = actionLogRows.reverse();
            actionsLogRowsDates = actionsLogRowsDates.reverse();

            const actionLogTable = [];
            let lastDate = null;
            for (let i = 0; i < actionLogRows.length; i++) {
                let row = actionLogRows[i];
                let rowDate = actionsLogRowsDates[i];
                if (lastDate !== rowDate) {
                    actionLogTable.push(
                        <tr key={'date-' + rowDate} colSpan="3">
                            <th colSpan="3">{rowDate}</th>
                        </tr>
                    );
                    lastDate = rowDate;
                }
                actionLogTable.push(row);
            }

            actionLogBody = (
                <table className='table'>
                    <thead>
                        <tr>
                            <th scope='col'>Time</th>
                            <th scope='col'>Type</th>
                            <th scope='col'>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actionLogTable}
                    </tbody>
                </table>
            );
        }

        return (
            <div className="container mt-3" >
                {
                    localStorage.getItem('token') ?
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
                                        Action Log
                                    </h5>
                                </div>
                                <div className="card-body">
                                    {
                                        actionLogBody
                                    }
                                </div>
                            </div>
                            <div className="card text-black bg-light my-3">
                                <div className="card-header">
                                    <h5 className='mb-0'>
                                        Occupancy Log
                                    </h5>
                                </div>
                                <div className='m-1' style={{ 'height': '60px' }} ref={ref => this.canvasContainer = ref}>
                                    <canvas className='border' ref={ref => this.canvas = ref}></canvas>
                                </div>
                                <div className="card-body">
                                    {
                                        occupancyLogBody
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
