/*
Copyright 2020 Awesome Technologies Innovationslabor GmbH

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
import { _t } from "../../../../../languageHandler";
import CallMediaHandler from "../../../../../CallMediaHandler";
import Field from "../../../elements/Field";
import AccessibleButton from "../../../elements/AccessibleButton";
import { SettingLevel } from "../../../../../settings/SettingsStore";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../../index";
import Modal from "../../../../../Modal";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import SettingsStore from "../../../../../settings/SettingsStore";
import ExternalInterface from "../../../../../interfaces/externalInterface";

export default class InterfaceUserSettingsTab extends React.Component {
    constructor() {
        super();

        this.state = {
            enabled: SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesEnabled'),
            selectedVendor: SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesVendor').toString(10),
            enableSettingsSave: false,
            enableSettingsTest: true,
            testError: '',
            testInProgress: false,
            interfaceAdress: SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAdress'),
        };
    }

    async componentDidMount() {

    }

    _onVendorChange = (e) => {
        this.setState({
            selectedVendor: e.target.value,
            enableSettingsSave: false,
        });
    };

    _onEnableChange = (checked) => {
          this.setState({
              enabled: checked,
          });
          if (!checked) {
              SettingsStore.setValue("ampInterfacesEnabled", null, SettingLevel.ACCOUNT, checked);
              SettingsStore.setValue("ampInterfacesUsername", null, SettingLevel.DEVICE, '');

              const content = {};
              content['enabled'] = false;
              content['vendor'] = '';
              content['interfaceAdress'] = '';
              MatrixClientPeg.get().setAccountData("care.amp.interfaces", content);
          }
    };

    _getSettings = (eventType = "care.amp.interfaces") => {
        const cli = MatrixClientPeg.get();
        if (!cli) return null;

        const event = cli.getAccountData(eventType);
        if (!event || !event.getContent()) return null;
        return event.getContent();
    };

    _onInterfaceAdressChanged = (e) => {
        this.setState({
            interfaceAdress: e.target.value,
            enableSettingsTest: true,
            enableSettingsSave: false,
        });
    };

    _testSettings = (e) => {
        this.setState({testInProgress: true});
        ExternalInterface.testInterface(this.state.selectedVendor, this.state.interfaceAdress, this._onTestSucceeded, this._onTestFailed);
    };

    _onTestSucceeded = (e) => {
        this.setState({
            enableSettingsSave: true,
            testError: '',
            testInProgress: false,
        });
    };

    _onTestFailed = (e) => {
        this.setState({
            testError: String(e),
            testInProgress: false,
        });
    };

    _saveSettings = (e) => {
        const loginMethod = ExternalInterface.getLoginMethod(this.state.selectedVendor);
        SettingsStore.setValue("ampInterfacesEnabled", null, SettingLevel.ACCOUNT, true);
        SettingsStore.setValue("ampInterfacesVendor", null, SettingLevel.ACCOUNT, this.state.selectedVendor);
        SettingsStore.setValue("ampInterfacesAdress", null, SettingLevel.ACCOUNT, this.state.interfaceAdress);

        SettingsStore.setValue("ampInterfacesUsername", null, SettingLevel.DEVICE, '');
        SettingsStore.setValue("ampInterfacesLoginMethod", null, SettingLevel.DEVICE, loginMethod);
        SettingsStore.setValue("ampInterfacesToken", null, SettingLevel.DEVICE, '');

        // persist settings
        const content = this._getSettings("care.amp.interfaces") || {};
        content['enabled'] = true;
        content['vendor'] = this.state.selectedVendor;
        content['loginMethod'] = loginMethod;
        content['interfaceAdress'] = this.state.interfaceAdress;

        MatrixClientPeg.get().setAccountData("care.amp.interfaces", content);

        this.setState({
            enableSettingsSave: false,
        });
    };

    _renderVendorOptions() {
        return <Field element="select" label={_t("Vendor")} id="vendor"
                     value={this.state.selectedVendor}
                     onChange={this._onVendorChange}>
                  <option key={`vendor-none`} value={'none'}>None</option>
                  <option key={`vendor-connext`} value={'vivendi'}>Connext Vivendi</option>
                  <option key={`vendor-profsys`} value={'profsys'}>IcSys ProfSys</option>
              </Field>;
    };

    render() {
        const SettingsFlag = sdk.getComponent("views.elements.SettingsFlag");
        const InlineSpinner = sdk.getComponent('elements.InlineSpinner');

        let interfaceAdress = null;
        let testButton = null;
        let vendorsDropdown = null;
        let saveButton = null;
        let error = null;
        let success = null;

        const enableDiv = <LabelledToggleSwitch value={this.state.enabled}
                                          onChange={this._onEnableChange}
                                          label={_t('Enable interfaces for this account')}/>;
        const spinner = this.state.testInProgress ? <InlineSpinner /> : null;

        if (this.state.enabled) {
            vendorsDropdown = this._renderVendorOptions();

            interfaceAdress = <Field id="interfaceAdress" label={_t("Interface adress")}
                   type="text" value={this.state.interfaceAdress} autoComplete="off"
                   onChange={this._onInterfaceAdressChanged} />;

            testButton = (
                <div className='mx_VoiceUserSettingsTab_missingMediaPermissions'>
                    <AccessibleButton onClick={this._testSettings} kind="primary" disabled={!this.state.enableSettingsTest}>
                        {_t("Test interface settings")}
                    </AccessibleButton>
                    {spinner}
                </div>
            );

            if (this.state.testError != '') {
                error = <p className='amp_interface_testError'>{_t('Error while connecting: ')}{this.state.testError}</p>;
            }

            if (this.state.enableSettingsSave) {
                success = <p className='amp_interface_testSuccess'>{_t('Connection successfully established')}</p>;
            }

            saveButton = <AccessibleButton onClick={this._saveSettings} kind="primary"
                              disabled={!this.state.enableSettingsSave}>
                              {_t("Save")}
                          </AccessibleButton>;

        }

        return (
            <div className="mx_SettingsTab amp_InterfaceUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Interfaces")}</div>
                <div className="mx_SettingsTab_section">
                    {enableDiv}
                    {vendorsDropdown}
                    {interfaceAdress}
                    {testButton}
                    {error}{success}
                    {saveButton}
                </div>
            </div>
        );
    }
}
