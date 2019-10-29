/*
Copyright 2019 Awesome Technologies Innovationslabor GmbH

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import {_t} from "../../../languageHandler";
import Field from "../elements/Field";
import classNames from 'classnames';

export default class AnamnesisData extends React.Component {
    constructor() {
        super();
        this.state = {
            responsiveness: '',
            pain: '',
            lastDefecation: '',
            misc: '',
        };
    }

    _onResponsivenessChanged = (e) => {
        this.setState({
            responsiveness: e.target.value,
        });
        this.props.onDataChanged('anamnesisData_responsiveness', e.target.value);
    };

    _onPainChanged = (e) => {
        this.setState({
            pain: e.target.value,
        });
        this.props.onDataChanged('anamnesisData_pain', e.target.value);
    };

    _onLastDefecationChanged = (e) => {
        this.setState({
            lastDefecation: e.target.value,
        });
        this.props.onDataChanged('anamnesisData_lastDefecation', e.target.value);
    };

    _onMiscChanged = (e) => {
        this.setState({
            misc: e.target.value,
        });
        this.props.onDataChanged('anamnesisData_misc', e.target.value);
    };

    render() {
        return (
            <div className="amp_CaseTab_section amp_Flex_column">
                <div className="mx_ProfileSettings_profile">
                    <Field id="profileDisplayName" className="amp_CreateCaseDialog_input_field" label={_t("Responsiveness")}
                                   type="text" value={this.state.responsiveness} autoComplete="off"
                                   onChange={this._onResponsivenessChanged} /><br/>
                    <Field id="profileDisplayName" className="amp_CreateCaseDialog_input_field" label={_t("Pain")}
                                   type="text" value={this.state.pain} autoComplete="off"
                                   onChange={this._onPainChanged} /><br/>
                    <Field id="profileDisplayName" className="amp_CreateCaseDialog_input_field" label={_t("Last defecation")}
                                   type="datetime-local" value={this.state.lastDefecation} autoComplete="off"
                                   onChange={this._onLastDefecationChanged} />
                </div>
                <div className="mx_ProfileSettings_profile">
                    <Field id="profileDisplayName" className="amp_CreateCaseDialog_input_field" label={_t("Misc")}
                                   type="text" value={this.state.misc} autoComplete="off"
                                   onChange={this._onMiscChanged} /><br/>
                </div>
            </div>
        );
    }
}
