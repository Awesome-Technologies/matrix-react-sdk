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

import ProfSys from './profsys';
import Vivendi from './vivendi';
import * as sdk from '../index';
import { _t } from '../languageHandler';
import Field from "../components/views/elements/Field";
import SettingsStore from "../settings/SettingsStore";
import {SettingLevel} from "../settings/SettingsStore";

export default class ExternalInterface {

    static getVendorInterface(vendor) {
        if (!vendor) {
            vendor = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesVendor');
        }

        if (vendor === 'profsys') {
            return ProfSys;
        }
        if (vendor === 'vivendi') {
            return Vivendi;
        }
    }

    /**
     * Test connection to the external api
     */
    static testInterface(vendor, url, success, failure) {
        if (vendor === 'profsys') {
            return ProfSys.testInterface(url, success, failure);
        }
        if (vendor === 'vivendi') {
            return Vivendi.testInterface(url, success, failure);
        }
    }

    static getLoginMethod(vendor) {
        return this.getVendorInterface(vendor).getLoginMethod();
    }

    static getLoginForm(vendor) {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return <div>
                    <Field id="caseTitle" className="amp_CreateCaseDialog_input_field"
                        autoFocus={true} size="12"
                        label={_t('User')}
                        autoComplete="off"
                        type="text"
                    />
                    <AccessibleButton className="amp_CreateCaseImportButton" onClick={this._importData} kind="primary">
                        {_t("Login")}
                    </AccessibleButton>
                </div>;
    }

    static async loginPassword(username, password) {
        return await this.getVendorInterface().login(username, password);
    }

    static async loginPin(pin) {
        return await this.getVendorInterface().login(pin);
    }

    static getUserName() {
        return this.getVendorInterface().getUserName();
    }

    static async getPatients() {
      return await this.getVendorInterface().getPatients();
    }

    static async getVitalData(patientId) {
      const vendorInterface = this.getVendorInterface();
      return await vendorInterface.getVitalData(patientId);
    }
}
