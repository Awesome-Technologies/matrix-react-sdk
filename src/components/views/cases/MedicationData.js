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

export default class MedicationData extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            activeAgent: '',
            brand: '',
            strength: '',
            form: '',
            mo: '',
            no: '',
            ev: '',
            ni: '',
            unit: '',
            notes: '',
            reason: '',
        };
    }

    _onActiveAgentChanged = (e) => {
        this.setState({
            activeAgent: e.target.value,
        });
        this.props.onDataChanged('medicationData_activeAgent', e.target.value);
    };

    _onBrandChanged = (e) => {
        this.setState({
            brand: e.target.value,
        });
        this.props.onDataChanged('medicationData_brand', e.target.value);
    };

    _onStrengthChanged = (e) => {
        this.setState({
            strength: e.target.value,
        });
        this.props.onDataChanged('medicationData_strength', e.target.value);
    };

    _onFormChanged = (e) => {
        this.setState({
            form: e.target.value,
        });
        this.props.onDataChanged('medicationData_form', e.target.value);
    };

    _onMoChanged = (e) => {
        this.setState({
            mo: e.target.value,
        });
        this.props.onDataChanged('medicationData_mo', e.target.value);
    };

    _onNoChanged = (e) => {
        this.setState({
            no: e.target.value,
        });
        this.props.onDataChanged('medicationData_no', e.target.value);
    };

    _onEvChanged = (e) => {
        this.setState({
            ev: e.target.value,
        });
        this.props.onDataChanged('medicationData_ev', e.target.value);
    };

    _onNiChanged = (e) => {
        this.setState({
            ni: e.target.value,
        });
        this.props.onDataChanged('medicationData_ni', e.target.value);
    };

    _onUnitChanged = (e) => {
        this.setState({
            unit: e.target.value,
        });
        this.props.onDataChanged('medicationData_unit', e.target.value);
    };

    _onNotesChanged = (e) => {
        this.setState({
            notes: e.target.value,
        });
        this.props.onDataChanged('medicationData_notes', e.target.value);
    };

    _onReasonChanged = (e) => {
        this.setState({
            reason: e.target.value,
        });
        this.props.onDataChanged('medicationData_reason', e.target.value);
    };

    render() {
        return (
            <div className="mx_ProfileSettings_profile">
            <Field id="profileDisplayName" label={_t("Active agent")}
                               type="text" value={this.state.activeAgent} autoComplete="off"
                               onChange={this._onActiveAgentChanged} />
            <Field id="profileDisplayName" label={_t("Brand")}
                               type="text" value={this.state.brand} autoComplete="off"
                               onChange={this._onBrandChanged} />
            <Field id="profileDisplayName" label={_t("Strength")}
                               type="text" value={this.state.strength} autoComplete="off"
                               onChange={this._onStrengthChanged} />
            <Field id="profileDisplayName" label={_t("Form")}
                               type="text" value={this.state.form} autoComplete="off"
                               onChange={this._onFormChanged} />
            <Field id="profileDisplayName" label={_t("mo")}
                               type="text" value={this.state.mo} autoComplete="off"
                               onChange={this._onMoChanged} />
            <Field id="profileDisplayName" label={_t("no")}
                               type="text" value={this.state.no} autoComplete="off"
                               onChange={this._onNoChanged} />
            <Field id="profileDisplayName" label={_t("ev")}
                               type="text" value={this.state.ev} autoComplete="off"
                               onChange={this._onEvChanged} />
            <Field id="profileDisplayName" label={_t("ni")}
                               type="text" value={this.state.ni} autoComplete="off"
                               onChange={this._onNiChanged} />
            <Field id="profileDisplayName" label={_t("Unit")}
                               type="text" value={this.state.unit} autoComplete="off"
                               onChange={this._onUnitChanged} />
            <Field id="profileDisplayName" label={_t("Notes")}
                               type="text" value={this.state.notes} autoComplete="off"
                               onChange={this._onNotesChanged} />
            <Field id="profileDisplayName" label={_t("Reason")}
                               type="text" value={this.state.reason} autoComplete="off"
                               onChange={this._onReasonChanged} />
            </div>
        );
    }
}
