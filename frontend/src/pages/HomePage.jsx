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
            broadcast: false,
            inuse: false,
        };

        this.props.socket.on('connect', () => {
            this.setState({
                connected: true
            });
        });

        this.props.socket.on('disconnect', () => {
            this.setState({
                connected: false
            });
        });

        this.props.socket.on('update-occupancy', (data) => {
            this.setState({
                occupied: !!data
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
                        <button className={'btn btn-lg btn-block' + (this.state.connected ? ' btn-success' : ' btn-danger')}>
                            {this.state.connected ?
                                <div>
                                    <b>Status:</b> Connected
                                </div> :
                                <div>
                                    <b>Status:</b> Not Connected
                                </div>
                            }
                        </button>
                        <button className={'btn btn-lg btn-block' + (this.state.occupied ? ' btn-success' : ' btn-warning')}>
                            {
                                this.state.occupied ?
                                    <div>
                                        <b>Occupancy:</b> Occupied
                                    </div>
                                    :
                                    <div>
                                        <b>Occupancy:</b> Unoccupied
                                    </div>
                            }
                        </button>
                        <button className="btn btn-primary btn-lg btn-block" type='doorbell' onClick={this.handleSoundAction} disabled={this.state.doorbell}>
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
                        <button className="btn btn-danger btn-lg btn-block" type='alarm' onClick={this.handleSoundAction} disabled={this.state.alarm}>
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
