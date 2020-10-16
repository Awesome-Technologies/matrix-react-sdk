/*
Copyright 2019 Michael Albert - Awesome Technologies Innovationslabor GmbH

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
import PatientData from '../cases/PatientData';
import VitalData from '../cases/VitalData';
import AnamnesisData from '../cases/AnamnesisData';
import Field from "../elements/Field";
import Modal from "../../../Modal";
import colorVariables from '../../../../res/themes/light/css/light.scss';
import SettingsStore from "../../../settings/SettingsStore";
import {SettingLevel} from "../../../settings/SettingLevel";

export default class CreateCaseDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            invitees: [],
            caseTitle: '',
            caseNote: '',
            caseSeverity: 'info',
            caseRecipient: '',
            caseRequesterName: '',
            caseRequesterDisabled: false,
            patientData_name: '',
            patientData_gender: 'unknown',
            patientData_birthDate: '',
            vitalData_bloodpressureSys: '',
            vitalData_bloodpressureDia: '',
            vitalData_bloodpressureDatetime: '',
            vitalData_pulse: '',
            vitalData_pulseDatetime: '',
            vitalData_temperature: '',
            vitalData_temperatureDatetime: '',
            vitalData_sugar: '',
            vitalData_sugarDatetime: '',
            vitalData_weight: '',
            vitalData_weightDatetime: '',
            vitalData_oxygen: '',
            vitalData_oxygenDatetime: '',
            anamnesisData_responsiveness: '',
            anamnesisData_pain: '',
            anamnesisData_lastDefecation: '',
            anamnesisData_misc: '',
            medicationData_activeAgent: '',
            medicationData_brand: '',
            medicationData_strength: '',
            medicationData_form: '',
            medicationData_mo: '',
            medicationData_no: '',
            medicationData_ev: '',
            medicationData_ni: '',
            medicationData_unit: '',
            medicationData_notes: '',
            medicationData_reason: '',
            noRecipientSelected: false,
        };
    }

    componentDidMount() {
        const interfaceEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesEnabled');
        const username = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesUsername');

        if (interfaceEnabled && username !== "") {
            this.setState({caseRequesterName: username, caseRequesterDisabled: true});
        }
    }

    onOk = () => {
      console.log("AMP.care: state test");
      console.log(this.state);

      if (this.state.invitees.length < 1) {
        this.setState({noRecipientSelected: true});
      } else {
        const caseData = this.parseData();
        const addrTexts = this.state.invitees.map((addr) => addr.address);

        const createOpts = {};
        createOpts.name = this.state.caseTitle;
        createOpts.creation_content = {'m.federate': false};
        createOpts.caseData = caseData;
        createOpts.is_direct = true;
        if (addrTexts.length >= 1) {
            createOpts.dmUserId = addrTexts[0];
        }

        this.props.onFinished(true, createOpts);
      }
    };

    onCancel = () => {
        this.props.onFinished(false);
    };

    formatDate = (dateString) => {
        if (dateString === '') return '';

        let givenDate;
        if (dateString === 'now') {
          givenDate = new Date();
        } else {
          givenDate = new Date(dateString);
        }
        const ret = givenDate.toISOString();
        return ret;
    };

    parseData = () => {
        // case data
        const caseContent = {
            title: this.state.caseTitle,
            note: this.state.caseNote,
            severity: this.state.caseSeverity,
            requester: {
              reference: this.state.caseRequesterName,
            },
        };

        // patient data
        let patientContent;
        if (this.state.patientData_name === '' &&
            this.state.patientData_gender === 'unknown' &&
            this.state.patientData_birthDate === '') {
            patientContent = null;
        } else {
            patientContent = {
                name: this.state.patientData_name,
                gender: this.state.patientData_gender,
                birthDate: this.formatDate(this.state.patientData_birthDate),
            };
        }

        // observation data
        const observationsContent = [];

        // anamnesis data
        if (this.state.anamnesisData_responsiveness !== '') {
            const responsivenessData = {
                id: 'responsiveness',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this.formatDate('now'),
                valueString: this.state.anamnesisData_responsiveness,
            };
            observationsContent.push(responsivenessData);
        }

        if (this.state.anamnesisData_pain !== '') {
            const painData = {
                id: 'pain',
                resourceType: 'Observation',
                code: {
                    coding: [{
                      code: '28319-2',
                      display: 'Pain status',
                      system: 'http://loinc.org'}],
                    text: 'Pain status',
                },
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this.formatDate('now'),
                valueString: this.state.anamnesisData_pain,
            };
            observationsContent.push(painData);
        }

        if (this.state.anamnesisData_misc !== '') {
            const miscData = {
                id: 'misc',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this.formatDate('now'),
                valueString: this.state.anamnesisData_misc,
            };
            observationsContent.push(miscData);
        }

        if (this.state.anamnesisData_lastDefecation !== '') {
            const defecationData = {
                id: 'last-defecation',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this.formatDate(this.state.anamnesisData_lastDefecation),
            };
            observationsContent.push(defecationData);
        }

        // vital data

        // weight
        if (this.state.vitalData_weight !== '') {
            const weightData = {
                id: 'body-weight',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: { coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category',
                  }],
                  text: 'Vital Signs',
                },
                code: {
                  coding: [{
                    code: '29463-7',
                    display: 'Body Weight',
                    system: 'http://loinc.org',
                  }],
                  text: 'Body Weight',
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                valueQuantity: {
                  code: 'kg',
                  system: 'http://unitsofmeasure.org',
                  unit: 'kg',
                  value: this.state.vitalData_weight,
                },
                effectiveDateTime: this.formatDate(this.state.vitalData_weightDatetime),
            };
            observationsContent.push(weightData);
        }

        // temperature
        if (this.state.vitalData_temperature !== '') {
            const temperatureData = {
                id: 'body-temperature',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category',
                  }],
                  text: 'Vital Signs',
                },
                code: {
                  coding: [{
                    code: '8310-5',
                    display: 'Body temperature',
                    system: 'http://loinc.org',
                  }],
                  text: 'Body temperature',
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                valueQuantity: {
                  code: 'Cel',
                  system: 'http://unitsofmeasure.org',
                  unit: 'C',
                  value: this.state.vitalData_temperature,
                },
                effectiveDateTime: this.formatDate(this.state.vitalData_temperatureDatetime),
            };
            observationsContent.push(temperatureData);
        }

        // glucose
        if (this.state.vitalData_sugar !== '') {
            const glucoseData = {
                id: 'glucose',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category',
                  }],
                  text: 'Vital Signs',
                },
                code: {
                  coding: [{
                    code: '15074-8',
                    display: 'Glucose [Milligramm/volume] in Blood',
                    system: 'http://loinc.org',
                  }],
                  text: 'Glucose',
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                valueQuantity: {
                  code: 'mg/dl',
                  system: 'http://unitsofmeasure.org',
                  unit: 'mg/dl',
                  value: this.state.vitalData_sugar,
                },
                effectiveDateTime: this.formatDate(this.state.vitalData_sugarDatetime),
            };
            observationsContent.push(glucoseData);
        }

        // bloodpressure
        if (this.state.vitalData_bloodpressureSys !== '' || this.state.vitalData_bloodpressureDia !== '') {
            const bloodpressureData = {
                id: 'blood-pressure',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category',
                  }],
                  text: 'Vital Signs',
                },
                code: {
                  coding: [{
                    code: '85354-9',
                    display: 'Blood pressure panel with all children optional',
                    system: 'http://loinc.org',
                  }],
                  text: 'Blood pressure systolic & diastolic',
                },
                component: [{
                  code: {
                    coding: [{
                      code: '8480-6',
                      display: 'Systolic blood pressure',
                      system: 'http://loinc.org',
                    }],
                    text: 'Systolic blood pressure',
                  },
                  valueQuantity: {
                    code: 'mm[Hg]',
                    system: 'http://unitsofmeasure.org',
                    unit: 'mmHg',
                    value: this.state.vitalData_bloodpressureSys,
                  },
                },
                {
                  code: {
                    coding: [{
                      code: '8462-4',
                      display: 'Diastolic blood pressure',
                      system: 'http://loinc.org',
                    }],
                    text: 'Diastolic blood pressure',
                  },
                  valueQuantity: {
                    code: 'mm[Hg]',
                    system: 'http://unitsofmeasure.org',
                    unit: 'mmHg',
                    value: this.state.vitalData_bloodpressureDia,
                  },
                }],
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                effectiveDateTime: this.formatDate(this.state.vitalData_bloodpressureDatetime),
            };
            observationsContent.push(bloodpressureData);
        }

        // pulse
        if (this.state.vitalData_pulse !== '') {
            const pulseData = {
                id: 'heart-rate',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category',
                  }],
                  text: 'Vital Signs',
                },
                code: {
                  coding: [{
                    code: '8867-4',
                    display: 'Heart rate',
                    system: 'http://loinc.org',
                  }],
                  text: 'Heart rate',
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                valueQuantity: {
                  code: '/min',
                  system: 'http://unitsofmeasure.org',
                  unit: 'beats/minute',
                  value: this.state.vitalData_pulse,
                },
                effectiveDateTime: this.formatDate(this.state.vitalData_pulseDatetime),
            };
            observationsContent.push(pulseData);
        }

        // oxygen
        if (this.state.vitalData_oxygen !== '') {
            const oxygenData = {
                id: 'oxygen',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category',
                  }],
                  text: 'Vital Signs',
                },
                code: {
                  coding: [{
                    code: '59408-5',
                    display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
                    system: 'http://loinc.org',
                  }],
                  text: 'Oxygen saturation',
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                valueQuantity: {
                  code: '%',
                  system: 'http://unitsofmeasure.org',
                  unit: '%',
                  value: this.state.vitalData_oxygen,
                },
                effectiveDateTime: this.formatDate(this.state.vitalData_oxygenDatetime),
            };
            observationsContent.push(oxygenData);
        }

        const content = {
          caseContent: caseContent,
          patientContent: patientContent,
          observationsContent: observationsContent,
        };

        return (content);
    };

    onCaseTitleChanged = (e) => {
        this.setState({
            caseTitle: e.target.value,
        });
    };

    onCaseNoteChanged = (e) => {
        this.setState({
            caseNote: e.target.value,
        });
    };

    onCaseRequesterChanged = (e) => {
        this.setState({
            caseRequesterName: e.target.value,
        });
    };

    onCaseSeverityChanged = (e) => {
        this.setState({
            caseSeverity: e.target.value,
        });

        switch (e.target.value) {
            case "info":
                document.getElementById("severity").style.backgroundColor =
                  colorVariables.amp_case_severity_info_color;
                break;
            case "request":
                document.getElementById("severity").style.backgroundColor =
                  colorVariables.amp_case_severity_request_color;
                break;
            case "urgent":
                document.getElementById("severity").style.backgroundColor =
                  colorVariables.amp_case_severity_urgent_color;
                break;
            case "critical":
                document.getElementById("severity").style.backgroundColor =
                  colorVariables.amp_case_severity_critical_color;
                break;
            default:
                break;
        }
    };

    onAddRecipientClicked = () => {
      const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
      Modal.createTrackedDialog('Select recipient', '', AddressPickerDialog, {
          title: _t('Select recipient'),
          description: _t("Who would you like to communicate with?"),
          placeholder: _t("Name or AMP.care ID"),
          validAddressTypes: ['mx-user-id'],
          button: _t("Add recipient"),
          onFinished: this._onSelectRecipientFinished,
      });
    };

    onSelectRecipientFinished = (shouldInvite, addrs) => {
      if (shouldInvite) {
        const addrTexts = addrs.map((addr) => addr.address);
        console.log("AMP.care: adding recipients:");
        console.log(addrTexts);
        this.setState({
            invitees: addrTexts,
            noRecipientSelected: false,
        });
      }
    };

    onRecipientChanged = (addrs) => {
      this.state.invitees = addrs;
    };

    onDataChanged = (key, value) => {
      this.setState({[key]: value});
    };

    importData = (shouldImport, data) => {
      if (shouldImport) {
          console.log(data);
          for (const key in data) {
            this.setState({[key]: data[key]});
          }

          const username = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesUsername');

          if (username !== "") {
              this.setState({caseRequesterName: username, caseRequesterDisabled: true});
          }
      }
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const AdressPicker = sdk.getComponent('views.cases.AdressPicker');
        const InterfaceImport = sdk.getComponent('views.cases.InterfaceImport');

        const interfaceEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesEnabled');
        const importArea = interfaceEnabled ? <InterfaceImport onFinished={this.importData} /> : null;

        const noRecipientSelected = this.state.noRecipientSelected ? {} : { display: 'none' };

        return (
            <BaseDialog className="amp_CreateCaseDialog" onFinished={this.props.onFinished}
                title={_t('Create Case')}
            >
                <form onSubmit={this.onOk}>
                    <div className="amp_Dialog_content">
                      <div>
                        <div className="amp_CaseTab_section">
                              <Field id="caseTitle" className="amp_CreateCaseDialog_input_field"
                                  autoFocus={true} size="64"
                                  label={_t('Case title')}
                                  autoComplete="off"
                                  type="text"
                                  onChange={this.onCaseTitleChanged}
                                  value={this.state.caseTitle}
                              />
                              <Field id="severity" ref="caseSeverity" className="amp_CreateCaseDialog_input_field" label={_t("Severity")} element="select" onChange={this.onCaseSeverityChanged} value={this.state.caseSeverity} >
                                  <option id="severityInfo" value="info" className="amp_Severity_info" >{_t("Info")}</option>
                                  <option id="severityRequest" value="request" className="amp_Severity_request" >{_t("Request")}</option>
                                  <option id="severityUrgent" value="urgent" className="amp_Severity_urgent" >{_t("Urgent")}</option>
                                  <option id="severityCritical" value="critical" className="amp_Severity_critical" >{_t("Critical")}</option>
                              </Field>
                          </div>

                          <div className="amp_CaseTab_section">
                              <Field id="caseNote" className="amp_CreateCaseDialog_input_field"
                                  label={_t('Case note')}
                                  element="textarea"
                                  onChange={this.onCaseNoteChanged}
                                  value={this.state.caseNote}
                              />
                          </div>

                          <div className="amp_CaseTab_section">
                              <Field id="requester" className="amp_CreateCaseDialog_input_field"
                                  label={_t('Requester')}
                                  size="64"
                                  type="text"
                                  onChange={this.onCaseRequesterChanged}
                                  value={this.state.caseRequesterName}
                                  disabled={this.state.caseRequesterDisabled}
                              />
                          </div>

                          <div className="amp_CreateCaseDialog_label amp_CreateCaseDialog_input_field">
                              <label htmlFor="textinput"> { _t('Recipient') } </label>
                          </div>
                          <AdressPicker focus={false} onSelectedListChanged={this.onRecipientChanged} placeholder={ _t('Name or AMP.care ID') } />
                      </div>
                    <br />
                    </div>

                    {importArea}

                    <h2>{_t("Manual entry")}</h2>
                    <details className="amp_CreateCaseDialog_details">
                        <summary className="amp_CreateCaseDialog_details_summary">{ _t('Patient data') }</summary>
                        <PatientData
                            onDataChanged={this.onDataChanged}
                            name={this.state.patientData_name}
                            gender={this.state.patientData_gender}
                            birthdate={this.state.patientData_birthDate}
                         />
                    </details>

                    <details className="amp_CreateCaseDialog_details">
                        <summary className="amp_CreateCaseDialog_details_summary">{ _t('Vital data') }</summary>
                        <VitalData
                            onDataChanged={this.onDataChanged}
                            bloodPressureSys={this.state.vitalData_bloodpressureSys}
                            bloodPressureDia={this.state.vitalData_bloodpressureDia}
                            bloodpressureDatetime={this.state.vitalData_bloodpressureDatetime}
                            pulse={this.state.vitalData_pulse}
                            pulseDatetime={this.state.vitalData_pulseDatetime}
                            temperature={this.state.vitalData_temperature}
                            temperatureDatetime={this.state.vitalData_temperatureDatetime}
                            sugar={this.state.vitalData_sugar}
                            sugarDatetime={this.state.vitalData_sugarDatetime}
                            weight={this.state.vitalData_weight}
                            weightDatetime={this.state.vitalData_weightDatetime}
                            oxygen={this.state.vitalData_oxygen}
                            oxygenDatetime={this.state.vitalData_oxygenDatetime}
                        />
                    </details>

                    <details className="amp_CreateCaseDialog_details">
                        <summary className="amp_CreateCaseDialog_details_summary">{ _t('Anamnesis') }</summary>
                        <AnamnesisData onDataChanged={this.onDataChanged} />
                    </details>
                </form>
                <div style={noRecipientSelected} className="amp_CreateCaseDialog_error">
                    { _t('No recipient selected') }
                </div>
                <DialogButtons primaryButton={_t('Send case')}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    }
}
