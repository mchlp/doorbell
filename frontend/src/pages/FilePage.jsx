import React from 'react';

export default class FilePage extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            fileText: 'Loading File...',
        };
    }

    componentDidMount() {
        console.log(this.props);
        const link = document.createElement('a');
        link.download = this.props.match.params.fileName;
        link.href = '/api/files/' + this.props.match.params.fileName;
        link.click();
        this.setState({
            fileText: 'File downloaded.'
        });
    }

    render() {
        return (
            <div className='m-3'>
                <h3>
                    {this.state.fileText}
                </h3>
            </div>
        );
    }
}