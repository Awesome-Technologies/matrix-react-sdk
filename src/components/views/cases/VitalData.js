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
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import Field from "../elements/Field";
import classNames from 'classnames';

export default class VitalData extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            bloodPressureSys: '',
            bloodPressureDia: '',
            bloodpressureDatetime: '',
            pulse: '',
            pulseDatetime: '',
            temperature: '',
            temperatureDatetime: '',
            sugar: '',
            sugarDatetime: '',
            weight: '',
            weightDatetime: '',
            oxygen: '',
            oxygenDatetime: '',
        };
    }

    _onBloodpressureSysChanged = (e) => {
        this.setState({
            bloodPressureSys: e.target.value,
        });
        this.props.onDataChanged('vitalData_bloodpressureSys', e.target.value);
    };

    _onBloodpressureDiaChanged = (e) => {
        this.setState({
            bloodPressureDia: e.target.value,
        });
        this.props.onDataChanged('vitalData_bloodpressureDia', e.target.value);
    };

    _onBloodpressureDatetimeChanged = (e) => {
        this.setState({
            bloodpressureDatetime: e.target.value,
        });
        this.props.onDataChanged('vitalData_bloodpressureDatetime', e.target.value);
    };

    _onPulseChanged = (e) => {
        //this.props.vitalData.pulse = e.target.value;
        this.setState({
            pulse: e.target.value,
        });
        this.props.onDataChanged('vitalData_pulse', e.target.value);
    };

    _onPulseDatetimeChanged = (e) => {
        this.setState({
            pulseDatetime: e.target.value,
        });
        this.props.onDataChanged('vitalData_pulseDatetime', e.target.value);
    };

    _onTemperatureChanged = (e) => {
        this.setState({
            temperature: e.target.value,
        });
        this.props.onDataChanged('vitalData_temperature', e.target.value);
    };

    _onTemperatureDatetimeChanged = (e) => {
        this.setState({
            temperatureDatetime: e.target.value,
        });
        this.props.onDataChanged('vitalData_temperatureDatetime', e.target.value);
    };

    _onSugarChanged = (e) => {
        this.setState({
            sugar: e.target.value,
        });
        this.props.onDataChanged('vitalData_sugar', e.target.value);
    };

    _onSugarDatetimeChanged = (e) => {
        this.setState({
            sugarDatetime: e.target.value,
        });
        this.props.onDataChanged('vitalData_sugarDatetime', e.target.value);
    };

    _onWeightChanged = (e) => {
        this.setState({
            weight: e.target.value,
        });
        this.props.onDataChanged('vitalData_weight', e.target.value);
    };

    _onWeightDatetimeChanged = (e) => {
        this.setState({
            weightDatetime: e.target.value,
        });
        this.props.onDataChanged('vitalData_weightDatetime', e.target.value);
    };

    _onOxygenChanged = (e) => {
        this.setState({
            oxygen: e.target.value,
        });
        this.props.onDataChanged('vitalData_oxygen', e.target.value);
    };

    _onOxygenDatetimeChanged = (e) => {
        this.setState({
            oxygenDatetime: e.target.value,
        });
        this.props.onDataChanged('vitalData_oxygenDatetime', e.target.value);
    };

    render() {
        return (
            <div className="amp_VitalData_section">
                <div className="amp_CaseTab_section">
                    <Field id="vitalDataBloodpressureSys" label={_t("Blood pressure systolic in mm/Hg")}
                                       type="number" step="1" value={this.state.bloodPressureSys} autoComplete="off"
                                       onChange={this._onBloodpressureSysChanged} />
                    <Field id="vitalDataBloodpressureDia" label={_t("Blood pressure diastolic in mm/Hg")}
                                       type="number" step="1" value={this.state.bloodPressureDia} autoComplete="off"
                                       onChange={this._onBloodpressureDiaChanged} />
                    <Field id="vitalDataBloodpressureDatetime" label={_t("Blood pressure datetime")}
                                           type="datetime-local" value={this.state.bloodpressureDatetime} autoComplete="off"
                                           onChange={this._onBloodpressureDatetimeChanged} />
                </div>
                <div className="amp_CaseTab_section">
                    <Field id="vitalDataPulse" label={_t("Pulse in bpm")}
                                       type="number" step="1" value={this.state.pulse} autoComplete="off"
                                       onChange={this._onPulseChanged} />
                    <Field id="vitalDataPulseDatetime" label={_t("Pulse datetime")}
                                           type="datetime-local" value={this.state.pulseDatetime} autoComplete="off"
                                           onChange={this._onPulseDatetimeChanged} />
                </div>
                <div className="amp_CaseTab_section">
                    <Field id="vitalDataTemperature" label={_t("Temperature in °C")}
                                       type="number" step="0.01" value={this.state.temperature} autoComplete="off"
                                       onChange={this._onTemperatureChanged} />
                    <Field id="vitalDataTemperatureDatetime" label={_t("Temperature datetime")}
                                           type="datetime-local" value={this.state.temperatureDatetime} autoComplete="off"
                                           onChange={this._onTemperatureDatetimeChanged} />
                </div>
                <div className="amp_CaseTab_section">
                    <Field id="vitalDataBloodsugar" label={_t("Blood sugar in mg/dl")}
                                       type="number" step="1" value={this.state.sugar} autoComplete="off"
                                       onChange={this._onSugarChanged} />
                    <Field id="vitalDataBloodsugarDatetime" label={_t("Blood sugar datetime")}
                                           type="datetime-local" value={this.state.sugarDatetime} autoComplete="off"
                                           onChange={this._onSugarDatetimeChanged} />
                </div>
                <div className="amp_CaseTab_section">
                    <Field id="vitalDataWeight" label={_t("Weight in kg")}
                                       type="number" step="0.01" value={this.state.weight} autoComplete="off"
                                       onChange={this._onWeightChanged} />
                    <Field id="vitalDataWeightDatetime" label={_t("Weight datetime")}
                                           type="datetime-local" value={this.state.weightDatetime} autoComplete="off"
                                           onChange={this._onWeightDatetimeChanged} />
                </div>
                <div className="amp_CaseTab_section">
                    <Field id="vitalDataOxygen" label={_t("Oxygen saturation in %")}
                                       type="number" step="0.01" value={this.state.oxygen} autoComplete="off"
                                       onChange={this._onOxygenChanged} />
                    <Field id="vitalDataOxygenDatetime" label={_t("Oxygen saturation datetime")}
                                           type="datetime-local" value={this.state.oxygenDatetime} autoComplete="off"
                                           onChange={this._onOxygenDatetimeChanged} />
                </div>
            </div>
        );
    }
}
