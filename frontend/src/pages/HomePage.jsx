import React, { Component } from 'react';
import LoginPage from './LoginPage';
import SocketContext from '../socket';

class HomePage extends Component {

    constructor(props) {
        super(props);
        this.state = {
            connected: false,
            occupied: false,
            doorbell: false,
            check: false,
            alarm: false,
            knock: false,
            broadcast: false,
            inuse: false,
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

        this.handleSoundAction = this.handleSoundAction.bind(this);
        this.handleBroadcast = this.handleBroadcast.bind(this);
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
