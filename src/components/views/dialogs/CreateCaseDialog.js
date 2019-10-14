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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import { _t } from '../../../languageHandler';
import PatientData from '../cases/PatientData';
import VitalData from '../cases/VitalData';
import AnamnesisData from '../cases/AnamnesisData';
import MedicationData from '../cases/MedicationData';
import Field from "../elements/Field";
import Modal from "../../../Modal";
import MatrixClientPeg from '../../../MatrixClientPeg';

export default createReactClass({
    displayName: 'CreateCaseDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            invitees: [],
            caseTitle: '',
            caseNote: '',
            caseSeverity: 'info',
            caseRecipient: '',
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
    },

    _onOk: function() {
      console.log("AMP.care: state test");
      console.log(this.state);

      if(this.state.invitees.length < 1){
        this.setState({noRecipientSelected: true});
      }
      else {
        var caseData = this._parseData();
        const addrTexts = this.state.invitees.map((addr) => addr.address);
        this.props.onFinished(true, this.state.caseTitle, false, addrTexts, caseData);
      }
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    _formatDate: function(dateString) {
        if(dateString === '') return '';

        let givenDate;
        if(dateString === 'now'){
          givenDate = new Date();
        }
        else{
          givenDate = new Date(dateString);
        }
        const ret = givenDate.toISOString();
        return ret;
    },

    _parseData: function() {
        let myId = MatrixClientPeg.get().getUserId();
        let content;

        // case data
        let caseContent = {
            title: this.state.caseTitle,
            note: this.state.caseNote,
            severity: this.state.caseSeverity,
            requester: {
              reference: myId
            }
        }

        // patient data
        let patientContent = {
            name: this.state.patientData_name,
            gender: this.state.patientData_gender,
            birthDate: this._formatDate(this.state.patientData_birthDate),
        }

        // observation data
        let observationsContent = [];

        // anamnesis data
        if(this.state.anamnesisData_responsiveness !== ''){
            let responsivenessData = {
                id: 'responsiveness',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this._formatDate('now'),
                valueString: this.state.anamnesisData_responsiveness,
            }
            observationsContent.push(responsivenessData);
        }

        if(this.state.anamnesisData_pain !== ''){
            let painData = {
                id: 'pain',
                resourceType: 'Observation',
                code: {
                    coding: [{
                      code: '28319-2',
                      display: 'Pain status',
                      system: 'http://loinc.org'}],
                    text: 'Pain status'
                },
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this._formatDate('now'),
                valueString: this.state.anamnesisData_pain,
            }
            observationsContent.push(painData);
        }

        if(this.state.anamnesisData_misc !== ''){
            let miscData = {
                id: 'misc',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this._formatDate('now'),
                valueString: this.state.anamnesisData_misc,
            }
            observationsContent.push(miscData);
        }

        if(this.state.anamnesisData_lastDefecation !== ''){
            let defecationData = {
                id: 'last-defecation',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                effectiveDateTime: this._formatDate(this.state.anamnesisData_lastDefecation),
            }
            observationsContent.push(defecationData);
        }

        // vital data

        // weight
        if(this.state.vitalData_weight !== ''){
            let weightData = {
                id: 'body-weight',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: { coding: [ {
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category'
                  }],
                  text: 'Vital Signs'
                },
                code: {
                  coding: [ {
                    code: '29463-7',
                    display: 'Body Weight',
                    system: 'http://loinc.org'
                  }],
                  text: 'Body Weight'
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns'
                },
                valueQuantity: {
                  code: 'kg',
                  system: 'http://unitsofmeasure.org',
                  unit: 'kg',
                  value: this.state.vitalData_weight,
                },
                effectiveDateTime: this._formatDate(this.state.vitalData_weightDatetime),
            }
            observationsContent.push(weightData);
        }

        // temperature
        if(this.state.vitalData_temperature !== ''){
            let temperatureData = {
                id: 'body-temperature',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [ {
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category'
                  }],
                  text: 'Vital Signs'
                },
                code: {
                  coding: [ {
                    code: '8310-5',
                    display: 'Body temperature',
                    system: 'http://loinc.org'
                  }],
                  text: 'Body temperature'
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns'
                },
                valueQuantity: {
                  code: 'Cel',
                  system: 'http://unitsofmeasure.org',
                  unit: 'C',
                  value: this.state.vitalData_temperature,
                },
                effectiveDateTime: this._formatDate(this.state.vitalData_temperatureDatetime),
            }
            observationsContent.push(temperatureData);
        }

        // glucose
        if(this.state.vitalData_sugar !== ''){
            let glucoseData = {
                id: 'glucose',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [ {
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category'
                  }],
                  text: 'Vital Signs'
                },
                code: {
                  coding: [{
                    code: '15074-8',
                    display: 'Glucose [Milligramm/volume] in Blood',
                    system: 'http://loinc.org'
                  }],
                  text: 'Glucose'
                },
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns'
                },
                valueQuantity: {
                  code: 'mg/dl',
                  system: 'http://unitsofmeasure.org',
                  unit: 'mg/dl',
                  value: this.state.vitalData_sugar,
                },
                effectiveDateTime: this._formatDate(this.state.vitalData_sugarDatetime),
            }
            observationsContent.push(glucoseData);
        }

        // bloodpressure
        if(this.state.vitalData_bloodpressureSys !== '' || this.state.vitalData_bloodpressureDia !== ''){
            let bloodpressureData = {
                id: 'blood-pressure',
                resourceType: 'Observation',
                subject: 'Patient/' + this.state.patientData_name,
                category: {
                  coding: [{
                    code: 'vital-signs',
                    display: 'Vital Signs',
                    system: 'http://hl7.org/fhir/observation-category'
                  }],
                  text: 'Vital Signs'
                },
                code: {
                  coding: [{
                    code: '85354-9',
                    display: 'Blood pressure panel with all children optional',
                    system: 'http://loinc.org'
                  }],
                  text: 'Blood pressure systolic & diastolic'
                },
                component: [{
                  code: {
                    coding: [{
                      code: '8480-6',
                      display: 'Systolic blood pressure',
                      system: 'http://loinc.org'
                    }],
                    text: 'Systolic blood pressure'
                  },
                  valueQuantity: {
                    code: 'mm[Hg]',
                    system: 'http://unitsofmeasure.org',
                    unit: 'mmHg',
                    value: this.state.vitalData_bloodpressureSys,
                  }
                },
                {
                  code: {
                    coding: [{
                      code: '8462-4',
                      display: 'Diastolic blood pressure',
                      system: 'http://loinc.org'
                    }],
                    text: 'Diastolic blood pressure'
                  },
                  valueQuantity: {
                    code: 'mm[Hg]',
                    system: 'http://unitsofmeasure.org',
                    unit: 'mmHg',
                    value: this.state.vitalData_bloodpressureDia,
                  }
                }],
                meta: {
                  profile: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
                },
                effectiveDateTime: this._formatDate(this.state.vitalData_bloodpressureDatetime),
            }
            observationsContent.push(bloodpressureData);
        }

        // pulse
        if(this.state.vitalData_pulse !== ''){
            let pulseData = {
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
                    system: 'http://loinc.org'
                  }],
                  text: 'Heart rate'
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
                effectiveDateTime: this._formatDate(this.state.vitalData_pulseDatetime),
            }
            observationsContent.push(pulseData);
        }

        // oxygen
        if(this.state.vitalData_oxygen !== ''){
            let oxygenData = {
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
                    system: 'http://loinc.org'
                  }],
                  text: 'Oxygen saturation'
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
                effectiveDateTime: this._formatDate(this.state.vitalData_oxygenDatetime),
            }
            observationsContent.push(oxygenData);
        }

        content = {
          caseContent: caseContent,
          patientContent: patientContent,
          observationsContent: observationsContent,
        };

        return(content);
    },

    _onCaseTitleChanged: function(e) {
        this.setState({
            caseTitle: e.target.value,
        });
    },

    _onCaseNoteChanged: function(e) {
        this.setState({
            caseNote: e.target.value,
        });
    },

    _onCaseSeverityChanged: function(e) {
        this.setState({
            caseSeverity: e.target.value,
        });
    },

    _onAddRecipientClicked: function() {
      const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
      Modal.createTrackedDialog('Select recipient', '', AddressPickerDialog, {
          title: _t('Select recipient'),
          description: _t("Who would you like to communicate with?"),
          placeholder: _t("Name or AMP.care ID"),
          validAddressTypes: ['mx-user-id'],
          button: _t("Add recipient"),
          onFinished: this._onSelectRecipientFinished,
      });
    },

    _onSelectRecipientFinished: function(shouldInvite, addrs) {
      if(shouldInvite){
        const addrTexts = addrs.map((addr) => addr.address);
        console.log("AMP.care: adding recipients:");
        console.log(addrTexts);
        this.setState({
            invitees: addrTexts,
            noRecipientSelected: false,
        });
      }
    },

    _onRecipientChanged: function(addrs) {
      this.state.invitees = addrs;
    },

    _onDataChanged: function(key, value) {
      this.setState({[key]: value});
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const AdressPicker = sdk.getComponent('views.cases.AdressPicker');

        const noRecipientSelected = this.state.noRecipientSelected ? {} : { display: 'none' };

        return (
            <BaseDialog className="amp_CreateCaseDialog" onFinished={this.props.onFinished}
                title={_t('Create Case')}
            >
                <form onSubmit={this.onOk}>
                    <div className="amp_Dialog_content">
                      <div>
                          <div className="amp_CreateCaseDialog_label">
                              <label htmlFor="textinput"> { _t('Title') } </label>
                          </div>

                          <div className="amp_CreateCaseDialog_input_container">
                              <input id="caseTitle" className="aw_CreateCaseDialog_input"
                                  autoFocus={true} size="64"
                                  placeholder={_t('Case title')}
                                  onChange={this._onCaseTitleChanged}
                                  value={this.state.caseTitle}
                              />
                          </div>

                          <div className="amp_CreateCaseDialog_label">
                              <label htmlFor="textinput"> { _t('Message') } </label>
                          </div>
                          <div className="amp_CreateCaseDialog_input_container">
                            <input id="caseNote" className="aw_CreateCaseDialog_input"
                                size="64"
                                placeholder={_t('Case note')}
                                onChange={this._onCaseNoteChanged}
                                value={this.state.caseNote}
                            />
                          </div>

                          <div className="amp_CreateCaseDialog_label">
                              <label htmlFor="textinput"> { _t('Recipient') } </label>
                          </div>
                          <div className="amp_CreateCaseDialog_input_container">
                            <AdressPicker focus={false} onSelectedListChanged={this._onRecipientChanged} placeholder={ _t('Name or AMP.care ID') }/>
                          </div>

                          <br />
                          <Field id="severity" ref="caseSeverity" label={_t("Severity")} element="select" onChange={this._onCaseSeverityChanged} value={this.state.caseSeverity} >
                              <option value="info">{_t("Info")}</option>
                              <option value="request">{_t("Request")}</option>
                              <option value="urgent">{_t("Urgent")}</option>
                              <option value="critical">{_t("Critical")}</option>
                          </Field>
                      </div>
                    </div>
                    <details className="amp_CreateCaseDialog_details">
                        <summary className="amp_CreateCaseDialog_details_summary">{ _t('Patient data') }</summary>
                        <div className="amp_CaseTab_section">
                            <PatientData onDataChanged={this._onDataChanged} />
                        </div>
                    </details>

                    <details className="amp_CreateCaseDialog_details">
                        <summary className="amp_CreateCaseDialog_details_summary">{ _t('Vital data') }</summary>
                        <div className="amp_CaseTab_section">
                            <VitalData onDataChanged={this._onDataChanged} />
                        </div>
                    </details>

                    <details className="amp_CreateCaseDialog_details">
                        <summary className="amp_CreateCaseDialog_details_summary">{ _t('Anamnesis') }</summary>
                        <div className="amp_CaseTab_section">
                            <AnamnesisData onDataChanged={this._onDataChanged} />
                        </div>
                    </details>
                </form>
                <div style={noRecipientSelected}  className="amp_CreateCaseDialog_error">
                    { _t('No recipient selected') }
                </div>
                <DialogButtons primaryButton={_t('Create Case')}
                    onPrimaryButtonClick={this._onOk}
                    onCancel={this._onCancel} />
            </BaseDialog>
        );
    },
});
