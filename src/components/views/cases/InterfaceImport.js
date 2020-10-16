/*
Copyright 2020 Michael Albert - Awesome Technologies Innovationslabor GmbH

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
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";
import {SettingLevel} from "../../../settings/SettingLevel";
import ExternalInterface from "../../../interfaces/externalInterface";

export default class InterfaceImport extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    getInitialState() {
        return {
            username: '',
            password: '',
            pin: '',
            loggedIn: false,
            error: '',
            patientsLoading: false,
            vitalDataLoading: false,
            patientId: '',
            patientList: [],
            patientData: {},
            patientDataLoaded: false,
            vitalData: {},
            vitalDataLoaded: false,
            nameSelected: false,
            genderSelected: false,
            birthdaySelected: false,
            bloodpressureSelected: false,
            pulseSelected: false,
            temperatureSelected: false,
            sugarSelected: false,
            weightSelected: false,
            spo2Selected: false,
        };
    }

    componentDidMount() {
        if (SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken')) {
            this.setState({loggedIn: true, error: ''});
            this._generatePatientList();
        }
    }

    onOk = () => {
        // send data back
        const data = {};

        // get username
        const username = ExternalInterface.getUserName();
        data.caseRequesterName = username;

        // get patient data
        if (this.state.nameSelected) {
            data.patientData_name = this.state.patientData.name;
        }

        if (this.state.genderSelected) {
            data.patientData_gender = this.state.patientData.gender;
        }

        if (this.state.birthdaySelected) {
            data.patientData_birthDate = this.state.patientData.birthday;
        }

        // get vital data
        if (this.state.bloodpressureSelected) {
            data.vitalData_bloodpressureSys = this.state.vitalData.bloodpressure.values.systolic;
            data.vitalData_bloodpressureDia = this.state.vitalData.bloodpressure.values.diastolic;
            data.vitalData_bloodpressureDatetime = this.state.vitalData.bloodpressure.date;
        }

        if (this.state.pulseSelected) {
            data.vitalData_pulse = this.state.vitalData.pulse.value;
            data.vitalData_pulseDatetime = this.state.vitalData.pulse.date;
        }

        if (this.state.temperatureSelected) {
            data.vitalData_temperature = this.state.vitalData.temperature.value;
            data.vitalData_temperatureDatetime = this.state.vitalData.temperature.date;
        }

        if (this.state.sugarSelected) {
            data.vitalData_sugar = this.state.vitalData.sugar.value;
            data.vitalData_sugarDatetime = this.state.vitalData.sugar.date;
        }

        if (this.state.weightSelected) {
            data.vitalData_weight = this.state.vitalData.weight.value;
            data.vitalData_weightDatetime = this.state.vitalData.weight.date;
        }

        if (this.state.spo2Selected) {
            data.vitalData_oxygen = this.state.vitalData.spo2.value;
            data.vitalData_oxygenDatetime = this.state.vitalData.spo2.date;
        }

        this.props.onFinished(true, data);

        this.setState({
            patientDataLoaded: false,
            vitalDataLoaded: false,
        });
    };

    onCancel = () => {
          this.props.onFinished(false);
    };

    onUsernameChanged = (e) => {
        this.setState({username: e.target.value});
    };

    onPasswordChanged = (e) => {
        this.setState({password: e.target.value});
    };

    onPinChanged = (e) => {
        this.setState({pin: e.target.value});
    };

    onPatientChanged = (e) => {
        this.setState({
            patientId: e.target.value,
            nameSelected: true,
            genderSelected: true,
            birthdaySelected: true,
            vitalData: {},
            vitalDataLoaded: false,
            patientDataLoaded: false,
            bloodpressureSelected: false,
            pulseSelected: false,
            temperatureSelected: false,
            sugarSelected: false,
            weightSelected: false,
            spo2Selected: false,
        });

        for (let index = 0; index < this.state.patientList.length; index++) {
            if (this.state.patientList[index].id == e.target.value) {
                this.setState({
                    patientData: {
                        name: this.state.patientList[index].givenName + " " + this.state.patientList[index].name,
                        gender: this.state.patientList[index].gender,
                        birthday: this.state.patientList[index].birthday,
                    },
                    patientDataLoaded: true,
                });
            }
        }
        this._fetchVitalData(e.target.value);
    };

    onBPToggled = (e) => {
        this.setState({bloodpressureSelected: e.target.checked});
    };

    onPulseToggled = (e) => {
        this.setState({pulseSelected: e.target.checked});
    };

    onTempToggled = (e) => {
        this.setState({temperatureSelected: e.target.checked});
    };

    onSugarToggled = (e) => {
        this.setState({sugarSelected: e.target.checked});
    };

    onWeightToggled = (e) => {
        this.setState({weightSelected: e.target.checked});
    };

    onSpo2Toggled = (e) => {
        this.setState({spo2Selected: e.target.checked});
    };

    onNameToggled = (e) => {
        this.setState({nameSelected: e.target.checked});
    };

    onGenderToggled = (e) => {
        this.setState({genderSelected: e.target.checked});
    };

    onBirthdayToggled = (e) => {
        this.setState({birthdaySelected: e.target.checked});
    };

    loginPassword = async () => {
        const res = await ExternalInterface.loginPassword(this.state.username, this.state.password);
        console.log(res);
        if (res.status != 200) {
            this.setState({loggedIn: false, error: res.data.message});
        } else {
            this.setState({loggedIn: true, error: ''});
            this._generatePatientList();
        }
    };

    loginPin = async () => {
        const res = await ExternalInterface.loginPin(this.state.pin);
        console.log(res);
        if (res.status != 200) {
            this.setState({loggedIn: false, error: res.data.message});
        } else {
            this.setState({loggedIn: true, error: ''});
            this._generatePatientList();
        }
    };

    generatePatientList = async () => {
        this.setState({patientsLoading: true});
        const res = await ExternalInterface.getPatients();
        console.log(res);

        if (res.status == 200) {
            this.setState({patientList: res.data, patientsLoading: false});
        } else {
            this.setState({loggedIn: false, patientsLoading: false, error: res.data.message});
        }
    };

    fetchVitalData = async (patientId) => {
        this.setState({vitalDataLoading: true});
        const res = await ExternalInterface.getVitalData(patientId);
        console.log(res);
        if (res) {
            this.setState({
                vitalData: res.data,
                vitalDataLoaded: true,
                vitalDataLoading: false,
            });
        }
        if (res.data.bloodpressure.date
          && res.data.bloodpressure.values.systolic
          && res.data.bloodpressure.values.diastolic) {
            this.setState({bloodpressureSelected: true});
        }
        if (res.data.pulse.date && res.data.pulse.value) {
            this.setState({pulseSelected: true});
        }
        if (res.data.temperature.date && res.data.temperature.value) {
            this.setState({temperatureSelected: true});
        }
        if (res.data.sugar.date && res.data.sugar.value) {
            this.setState({sugarSelected: true});
        }
        if (res.data.weight.date && res.data.weight.value) {
            this.setState({weightSelected: true});
        }
        if (res.data.spo2.date && res.data.spo2.value) {
            this.setState({spo2Selected: true});
        }
    };

    formatDate = (dateString, withTime=true) => {
        if (dateString === '') return '';

        const date = new Date(dateString);
        if (withTime) {
            return date.toLocaleDateString() + ' - ' + date.toLocaleTimeString();
        } else {
            return date.toLocaleDateString();
        }
    };

    renderLoginArea = () => {
        if (this.state.loggedIn) {
            return null;
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const loginMethod = ExternalInterface.getLoginMethod();

        if (loginMethod === 'user') {
            return <div>
                <div className="amp_CaseTab_section">
                    <Field id="username" className="amp_CreateCaseDialog_input_field"
                        autoFocus={true} size="20"
                        label={_t('User')}
                        autoComplete="off"
                        type="text"
                        onChange={this.onUsernameChanged}
                        value={this.state.username}
                        />
                    <Field id="password" className="amp_CreateCaseDialog_input_field"
                        size="20"
                        label={_t('Password')}
                        autoComplete="off"
                        type="text"
                        onChange={this.onPasswordChanged}
                        value={this.state.password}
                        />
                    <AccessibleButton className="amp_CreateCaseImportButton" onClick={this.loginPassword} kind="primary">
                        {_t("Login")}
                    </AccessibleButton>
                </div>
                <span className="amp_CreateCaseDialog_error">{this.state.error}</span>
            </div>;
        } else { // Pin login by default
            return <div>
                <div className="amp_CaseTab_section">
                    <Field id="pin" className="amp_CreateCaseDialog_input_field"
                        size="20"
                        label={_t('PIN')}
                        autoComplete="off"
                        type="text"
                        onChange={this.onPinChanged}
                        value={this.state.pin}
                        />
                    <AccessibleButton className="amp_CreateCaseImportButton" onClick={this.loginPin} kind="primary">
                        {_t("Login")}
                    </AccessibleButton>
                </div>
                <span className="amp_CreateCaseDialog_error">{this.state.error}</span>
            </div>;
        }
    };

    renderPatientList = () => {
      if (!this.state.loggedIn) return null;

      return <Field
                id="patients"
                ref="patients"
                className="amp_CreateCaseDialog_input_field"
                label={_t("Select patient")}
                element="select"
                onChange={this.onPatientChanged}
                value={this.state.patientId} >
                  <option key="-1" id="-1" value="-1" className="amp_patient_info" >{_t("Nothing selected")}</option>
                  {this.state.patientList.map(item => (
                    <option key={item.id} id={item.id} value={item.id} className="amp_patient_info" >{item.name}, {item.givenName} - {this.formatDate(item.birthday, false)}</option>
                  ))}
              </Field>;
    };

    renderPatientData = () => {
      if (!this.state.patientDataLoaded) return null;

      const InlineSpinner = sdk.getComponent('elements.InlineSpinner');
      const vitalDataSpinner = this.state.vitalDataLoading ? <InlineSpinner /> : null;

      return <div>
            <h3>{_t("Patient data")}</h3>
            <table><tbody>
              <tr>
                <td><input type="checkbox" onChange={this.onNameToggled} checked={this.state.nameSelected} /></td>
                <td>{_t("Name")}</td>
                <td>{this.state.patientData.name}</td>
              </tr>
              <tr>
                <td><input type="checkbox" onChange={this.onGenderToggled} checked={this.state.genderSelected} /></td>
                <td>{_t("Gender")}</td>
                <td>{_t(this.state.patientData.gender)}</td>
              </tr>
              <tr>
                <td><input type="checkbox" onChange={this.onBirthdayToggled} checked={this.state.birthdaySelected} /></td>
                <td>{_t("Birthday")}</td>
                <td>{this._formatDate(this.state.patientData.birthday, false)}</td>
              </tr>
            </tbody></table>
            {vitalDataSpinner}
        </div>;
    };

    renderVitalData = () => {
      if (!this.state.vitalDataLoaded) return null;

      const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

      return <div><h3>{_t("Vital data")}</h3>
        <table><tbody>
          <tr>
            <td><input type="checkbox" onChange={this.onBPToggled} checked={this.state.bloodpressureSelected} /></td>
            <td>{_t("Blood pressure")}</td>
            <td>{this.state.vitalData.bloodpressure.values.systolic} / {this.state.vitalData.bloodpressure.values.diastolic}</td>
            <td>mm/Hg</td>
            <td>{this._formatDate(this.state.vitalData.bloodpressure.date)}</td>
          </tr>
          <tr>
            <td><input type="checkbox" onChange={this.onPulseToggled} checked={this.state.pulseSelected} /></td>
            <td>{_t("Pulse")}</td>
            <td>{this.state.vitalData.pulse.value}</td>
            <td>bpm</td>
            <td>{this._formatDate(this.state.vitalData.pulse.date)}</td>
          </tr>
          <tr>
            <td><input type="checkbox" onChange={this.onTempToggled} checked={this.state.temperatureSelected} /></td>
            <td>{_t("Temperature")}</td>
            <td>{this.state.vitalData.temperature.value}</td>
            <td>°C</td>
            <td>{this._formatDate(this.state.vitalData.temperature.date)}</td>
          </tr>
          <tr>
            <td><input type="checkbox" onChange={this.onSugarToggled} checked={this.state.sugarSelected} /></td>
            <td>{_t("Blood sugar")}</td>
            <td>{this.state.vitalData.sugar.value}</td>
            <td>mg/dl</td>
            <td>{this._formatDate(this.state.vitalData.sugar.date)}</td>
          </tr>
          <tr>
            <td><input type="checkbox" onChange={this.onWeightToggled} checked={this.state.weightSelected} /></td>
            <td>{_t("Weight")}</td>
            <td>{this.state.vitalData.weight.value}</td>
            <td>kg</td>
            <td>{this._formatDate(this.state.vitalData.weight.date)}</td>
          </tr>
          <tr>
            <td><input type="checkbox" onChange={this.onSpo2Toggled} checked={this.state.spo2Selected} /></td>
            <td>{_t("Oxygen saturation")}</td>
            <td>{this.state.vitalData.spo2.value}</td>
            <td>%</td>
            <td>{this._formatDate(this.state.vitalData.spo2.date)}</td>
          </tr>
        </tbody></table>
        <AccessibleButton className="amp_CreateCaseImportButton" onClick={this.onOk} kind="primary">
            {_t("Import data")}
        </AccessibleButton>
        </div>;
    };

    render() {
        const InlineSpinner = sdk.getComponent('elements.InlineSpinner');
        const patientSpinner = this.state.patientsLoading ? <InlineSpinner /> : null;

        return (
            <div className="amp_Dialog_content">
                <h2>{_t("Import data")}</h2>
                {this.renderLoginArea()}
                <div>
                    <div className="amp_CaseTab_section">
                        {patientSpinner}
                        {this.renderPatientList()}
                    </div>
                    <div className="amp_CaseTab_section">
                        {this.renderPatientData()}
                    </div>
                    <div className="amp_CaseTab_section">
                        {this.renderVitalData()}
                    </div>
                </div>
            </div>
        );
    }
}
