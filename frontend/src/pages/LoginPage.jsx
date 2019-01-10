import React, { Component } from 'react';
import axios from 'axios';

export default class LoginPage extends Component {

    constructor(props) {
        super(props);
        this.handleLogin = this.handleLogin.bind(this);
    }

    async handleLogin(e) {
        e.preventDefault();
        const res = await axios.post('/api/login/', {
            password: document.getElementById('password').value
        });
        if (res.data.status === 'success') {
            localStorage.setItem('token', res.data.token);
        }
        window.location.reload();
    }

    render() {
        return (
            <div className="container mt-5">
                <form>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" className="form-control" id="password" placeholder="Enter password" required />
                    </div>
                    <button type="submit" className="btn btn-primary" onClick={this.handleLogin}>Log In</button>
                </form>
            </div>
        );
    }
}
