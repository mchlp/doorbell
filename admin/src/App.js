import React, { Component } from 'react';
import AdminPage from './pages/AdminPage';
import Page404 from './pages/Page404';
import SocketContext from './socket';
import * as io from 'socket.io-client';
import { BrowserRouter } from 'react-router-dom';
import { Route, Switch } from 'react-router';
import PrivateRoute from './components/PrivateRoute';

class App extends Component {

    constructor(props) {
        super(props);
        this.socket = io('/admin');
    }

    render() {
        return (
            <SocketContext.Provider value={this.socket}>
                <BrowserRouter>
                    <div className="App">
                        <Switch>
                            <PrivateRoute exact path='/' component={AdminPage} />
                            <Route component={Page404} />
                        </Switch>
                    </div>
                </BrowserRouter>
            </SocketContext.Provider>
        );
    }
}
export default App;