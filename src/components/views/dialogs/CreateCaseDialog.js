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
import StyledCheckbox from "../elements/StyledCheckbox";
import Modal from "../../../Modal";
import colorVariables from '../../../../res/themes/light/css/light.scss';
import SettingsStore from "../../../settings/SettingsStore";
import {SettingLevel} from "../../../settings/SettingLevel";
import {MatrixClientPeg} from '../../../MatrixClientPeg';

export default class CreateCaseDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            invitees: [],
            noRecipientSelected: false,
            form_data: {},
            data: {},
        };



        const form_data = {
  "name": "Formular Name",
  "type": "formular_maerkisch",
  "form": [[{
          "name": "reason",
          "label": "Anlass",
          "group": "case",
          "type": "Dropdown",
          "mandatory": true,
          "default": "other",
          "values": [
            {
              "value": "careLevel",
              "label": "Pflegegradeinstufung"
            },
            {
              "value": "assistence",
              "label": "Hilfsmittelunterstützung"
            },
            {
              "value": "disability",
              "label": "Schwerbehinderung"
            },
            {
              "value": "ambulantCare",
              "label": "ambulante Versorgung"
            },
            {
              "value": "selfMgmt",
              "label": "Selbstmanagement"
            },
            {
              "value": "careError",
              "label": "Pflegefehler"
            },
            {
              "value": "other",
              "label": "Sonstiges"
            }
          ],
          "width": 4,
          "printable": true
        }],
        [{
          "name": "name",
          "label": "Name",
          "group": "patient",
          "type": "Textline",
          "type_annotation": "text",
          "mandatory": true,
          "enabled": true,
          "hint": "Bitte geben Sie den Namen des Patienten ein",
          "width": 6,
          "printable": true
        },
        {
          "name": "birthdate",
          "label": "Geburtsdatum",
          "group": "patient",
          "type": "Textline",
          "type_annotation": "date",
          "mandatory": true,
          "hint": "Bitte geben Sie das Geburtsdatum des Patienten ein",
          "width": 6,
          "printable": true
        },
        {
          "name": "gender",
          "label": "Geschlecht",
          "group": "patient",
          "type": "Dropdown",
          "mandatory": true,
          "values": [
            {
              "value": "unknown",
              "label": "unbekannt"
            },
            {
              "value": "male",
              "label": "männlich"
            },
            {
              "value": "female",
              "label": "weiblich"
            },
            {
              "value": "undefined",
              "label": "undefiniert"
            }
          ],
          "hint": "Bitte wählen Sie das Geschlecht des Patienten aus",
          "width": 6,
          "printable": true
        },
        {
          "name": "address",
          "label": "Adresse",
          "group": "patient",
          "type": "Textline",
          "type_annotation": "text",
          "mandatory": true,
          "hint": "Bitte geben Sie die Adresse des Patienten ein",
          "width": 6,
          "printable": true
        },
        {
          "name": "contactPerson",
          "label": "weiterer Ansprechpartner",
          "group": "patient",
          "type": "Textline",
          "type_annotation": "text",
          "mandatory": true,
          "hint": "Bitte geben Sie einen weiteren Ansprechpartner des Patienten ein",
          "width": 6,
          "printable": true
        },
        {
          "name": "vollmachtVorhanden",
          "label": "Vollmacht vorhanden?",
          "group": "patient",
          "type": "SingleSelect",
          "mandatory": false,
          "values": [
            {
              "value": "yes",
              "label": "Ja"
            },
            {
              "value": "no",
              "label": "Nein"
            }
          ],
          "width": 4,
          "printable": true
        },
        {
          "name": "contact",
          "label": "Kontaktdaten",
          "group": "patient",
          "type": "Textline",
          "type_annotation": "text",
          "mandatory": true,
          "hint": "Bitte geben Sie eine Telefonnummer oder eine Emailadresse für den Kontakt ein",
          "width": 6,
          "printable": true
        },
        {
          "name": "legalApproval",
          "label": "Rechtsgültige Zustimmung",
          "group": "patient",
          "type": "SingleSelect",
          "mandatory": true,
          "values": [
            {
              "value": "yes",
              "label": "Ja"
            },
            {
              "value": "no",
              "label": "Nein"
            }
          ],
          "hint": "Bitte geben Sie an ob eine rechtsgültige Zustimmung des Patienten vorliegt",
          "width": 6,
          "printable": true
        },
        {
          "name": "diagnosis",
          "label": "Aktuelle Diagnose",
          "group": "case",
          "type": "Multiline",
          "mandatory": true,
          "hint": "Bitte geben Sie Fragen oder Anmerkungen an",
          "width": 6,
          "printable": true
        }
      ]
  ]
}


    }

    async componentDidMount() {
        const interfaceEnabled = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesEnabled');
        const username = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesUsername');

        if (interfaceEnabled && username !== "") {
            this.setState({caseRequesterName: username, caseRequesterDisabled: true});
        }

        //TODO load form data from synapse
        const client = MatrixClientPeg.get();
        let result = await client._http.authedRequest(
            undefined, "GET", "/capabilities",
        ).catch((e) => {
            logger.error(e);
            return null; // otherwise consume the error
        }).then((r) => {
            if (!r) r = {};
            const form_data = r["capabilities"] || {};
            console.log("form");
            console.log(form_data);

            this.setState({ from_data: form_data });
        });
    }

    onOk = () => {
      if (this.state.invitees.length < 1) {
        this.setState({noRecipientSelected: true});
      } else {

        const caseData = {
          caseContent: this.state.data.case,
          patientContent: this.state.data.patient,
        };

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

    onChange = (group, name, value, type) => {
      if (type === "date") {
        value = this.formatDate(value);
      }
      this.setState({ data: { ...this.state.data, [group]: { ...this.state.data[group], [name]: value } }});
    };

    parseFormJson = () => {

      /* TODO parse json from string
      try {
        const json = JSON.parse(this.state.form_data);
      } catch (e) {
          console.log("Invalid form json");
          return false;
      }
      */

      const json = this.state.form_data.form;

      if (!json) {
        return;
      }

      let jsx = [];

      for(var i=0; i<json.length; i++) {
        json[i].forEach((item, index) => {

          if (item.type == "Textline") {
            if (item.visible) {
              console.log(item.visible);
            }
            jsx.push(
                <div className="amp_CaseTab_section" key={`item-${index}`}>
                    <Field
                        id={item.group + "." + item.name}
                        className={
                          item.name
                        }
                        label={_t(item.label)}
                        size={item.width}
                        type={item.type_annotation}
                        onChange={(e) => this.onChange(item.group,  item.name, e.target.value, item.type_annotation)}
                        //disabled={Boolean(item.enabled)}
                        tooltipContent={item.hint}
                        forceTooltipVisible={true}
                    />
                    {item.errors && (
                      <div className="invalid-feedback">{item.errors}</div>
                    )}
                </div>
            );
          }

          if (item.type == "Multiline") {
            if (item.visible) {
              console.log(item.visible);
            }
            jsx.push(
                <div className="amp_CaseTab_section" key={`item-${index}`}>
                    <Field
                        id={item.group + "." + item.name}
                        className={
                          item.name
                        }
                        label={_t(item.label)}
                        element="textarea"
                        name={item.name}
                        onChange={(e) => this.onChange(item.group, item.name, e.target.value)}
                        tooltipContent={item.hint}
                        forceTooltipVisible={true}
                    />
                    {item.errors && (
                      <div className="invalid-feedback">{item.errors}</div>
                    )}
                </div>
            );
          }

          if (item.type == "SingleSelect") {
            jsx.push(
                <div className="amp_CaseTab_section" key={`item-${index}`}>
                    <StyledCheckbox
                        name={item.name}
                        checked={item.default}
                        onChange={(e) => this.onChange(item.group, item.name, e.target.checked)}
                    >
                        {item.label}
                    </StyledCheckbox>
                      {item.errors && (
                        <div className="invalid-feedback">{item.errors}</div>
                      )}
                </div>
            );
          }

          if (item.type == "Dropdown") {
            jsx.push(<div className="row mt-4">
                <div className="row mt-3" key={`item-${index}`}>
                  <div className="col">
                    <Field
                        id={item.group + "." + item.name}
                        ref={item.group + "." + item.name}
                        className="" label={_t(item.label)}
                        element="select"
                        onChange={(e) => this.onChange(item.group, item.name, e.target.value)}
                    >
                      {item.values.map((subitem, index) => (
                        <option id={index} value={subitem.value} className="" >{_t(subitem.label)}</option>
                      ))}
                    </Field>

                    {item.errors && (
                      <div className="invalid-feedback">{item.errors}</div>
                    )}
                    </div>
                  </div>
            </div>);
          }
        });

      }

      return jsx;
    }

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
        console.log(this.state.data);
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const AdressPicker = sdk.getComponent('views.cases.AdressPicker');
        const InterfaceImport = sdk.getComponent('views.cases.InterfaceImport');

        const interfaceEnabled = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesEnabled');
        const importArea = interfaceEnabled ? <InterfaceImport onFinished={this.importData} /> : null;

        const noRecipientSelected = this.state.noRecipientSelected ? {} : { display: 'none' };

        return (
            <BaseDialog className="amp_CreateCaseDialog" onFinished={this.props.onFinished}
                title={_t('Create Case')}
            >
                <form onSubmit={this.onOk}>
                    <div className="amp_CreateCaseDialog_label amp_CreateCaseDialog_input_field">
                        <label htmlFor="textinput"> { _t('Recipient') } </label>
                    </div>
                    <AdressPicker focus={false} onSelectedListChanged={this.onRecipientChanged} placeholder={ _t('Name or AMP.care ID') } />
                    { importArea }
                    { this.parseFormJson() }
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
