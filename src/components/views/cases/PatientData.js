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

export default class PatientData extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            name: '',
            gender: 'unknown',
            birthdate: '',
        };
    }

    _onNameChanged = (e) => {
        this.setState({
            name: e.target.value,
        });
        this.props.onDataChanged('patientData_name', e.target.value);
    };

    _onGenderChanged = (e) => {
        this.setState({
            gender: e.target.value,
        });
        this.props.onDataChanged('patientData_gender', e.target.value);
    };

    _onBirthdateChanged = (e) => {
        this.setState({
            birthdate: e.target.value,
        });
        this.props.onDataChanged('patientData_birthDate', e.target.value);
    };

    render() {
        return (
          <div className="mx_ProfileSettings_profile">
              <Field id="patientPatientName" label={_t("Patient name")}
                     type="text" value={this.state.name} autoComplete="off"
                     onChange={this._onNameChanged} />
              <Field id="gender" label={_t("Gender")} element="select"
                     value={this.state.gender} onChange={this._onGenderChanged}>
                  <option value="unknown">{_t("Unknown")}</option>
                  <option value="female">{_t("Female")}</option>
                  <option value="male">{_t("Male")}</option>
                  <option value="other">{_t("Other")}</option>
              </Field>
              <Field id="patientBirthday" label={_t("Birthday")}
                     type="date" value={this.state.birthdate} autoComplete="off"
                     onChange={this._onBirthdateChanged} />
          </div>
        );
    }
}
