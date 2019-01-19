import React, { Component } from 'react';
import HomePage from './pages/HomePage';
import SocketContext from './socket';
import * as io from 'socket.io-client';

class App extends Component {

    constructor(props) {
        super(props);
        this.socket = io('');
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