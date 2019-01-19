import React, { Component } from 'react';
import HomePage from './pages/HomePage';
import SocketContext from './socket';
import * as io from 'socket.io-client';

class App extends Component {

    constructor(props) {
        super(props);
        this.socket = io(':3002');
        const token = localStorage.getItem('token');
        if (token) {
            this.socket.emit('authenticate', {
                token: token
            });
            this.socket.on('authenticate-reply', (data) => {
                if (data.status === 'failed') {
                    localStorage.removeItem('token');
                    window.location.reload();
                }
            });
        }
    }

    render() {
        return (
            <SocketContext.Provider value={this.socket}>
                <div className="App">
                    <HomePage />
                </div>
            </SocketContext.Provider>
        );
    }
}
export default App;