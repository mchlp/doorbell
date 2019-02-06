import React from 'react';
import {Route, Redirect} from 'react-router-dom';

export const PrivateRoute = ({component: Component, ...rest}) => (
    <Route {...rest} render={props => {
        //let next = props.location.pathname.substring(1);
        return localStorage.getItem('token')
            ? <Component {...props} />
            : <Redirect to={'/login' /*+ (next ? '?next=' + next : '')*/} />;
    }} />
);

export default PrivateRoute;