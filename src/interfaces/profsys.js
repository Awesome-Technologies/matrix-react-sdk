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

import SettingsStore from "../settings/SettingsStore";
import {SettingLevel} from "../settings/SettingsStore";

export default class ProfSys {
    /**
     * Test connection to the external api
     * @param {String} url The URL of the API for the third party software
     * @param {String} success Callback function for successful connection test
     * @param {String} failure Callback function for connection failure
     * @return {Object} Result from the connection test
     */
    static async testInterface(url, success, failure) {
        await fetch(url + '/api/info/product', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        }).then(function(response) {
            if (!response.ok) {
                throw Error(response.statusText);
            }
            // Read the response as json.
            return response.json();
        })
        .then(function(responseAsJson) {
            console.log(responseAsJson);
            if (responseAsJson.ProductName && responseAsJson.ProductName === "ProfSys App Stationär") {
                success();
            } else {
                failure();
            }
        })
        .catch(function(error) {
            console.log('Looks like there was a problem: \n', error);
            failure();
        });
    }

    // Authorization method of the external api
    static getLoginMethod() {
        return 'pin';
    }

    /**
    * Login to the ProfSys API
    * @param {String} pin The pin for the ProfSys user
    * @return {Object} Result from the login API in json format
    */
    static async login(pin) {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAdress');
        const body = {PIN: pin};
        const response = await fetch(url + '/api/authentication/login', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        .then(response => {
            return response.json().then(data => ({
                data: data,
                status: response.status,
            })).then(res => {
                return {status: res.status, data: res.data};
            });
        })
        .then(res => {
            if (res.status != 200) {
                throw Object.assign({status: res.status, data: res.data});
            }

            if (res.data.UserName) {
                SettingsStore.setValue("ampInterfacesUsername", null, SettingLevel.DEVICE, res.data.UserName);
            }
            SettingsStore.setValue("ampInterfacesToken", null, SettingLevel.DEVICE, res.data.Token);
            return {data: {username: res.data.UserName, token: res.data.Token}, status: 200};
        })
        .catch((error) => {
            console.log(error);
            if (typeof error === "object") {
                if (error.data && error.data.ErrorMessages) {
                    return {status: error.status, data: {message: error.data.ErrorMessages[0]}};
                }
                return {status: error.status, data: {message: error.message}};
            } else {
                console.error(error);
            }
        });

        return response;
    }


    static getUserName() {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesUsername');
    }

    /**
     * Loads the list of associated patients
     */
    static async getPatients() {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAdress');
        const token = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken');

        return await fetch(url + '/api/stammdaten/klient/list', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Token': token,
            },
        })
        .then(response => {
            if (!response.ok) {
                throw Object.assign({status: response.status, message: response.statusText});
            }

            return response.json();
        })
        .then(res => {
            const values = {data: [], status: 200};
            for (let i=0; i<res.length; i++) {
                const value = {};
                value.id = res[i].ID;
                value.gender = this.mapGender(res[i].GeschlechtID);
                if (res[i].Geburtsdatum) {
                    value.birthday = res[i].Geburtsdatum;
                }
                value.name = res[i].Bezeichnung.split(' ')[1].slice(0, -1);
                value.givenName = res[i].Bezeichnung.split(' ')[2];
                values.data[i] = value;
            }
            return values;
        })
        .catch((error) => {
            if (typeof error === "object") {
                return {status: error.status, data: {message: error.message}};
            } else {
                console.error(error);
            }
        });
    }

    static mapGender(genderId) {
        switch (genderId) {
          case 1:
            return 'male';
          case 2:
            return 'female';
          case 4:
            return 'other';
          default: // id 3 and default
            return 'unknown';
        }
    }

    // Collect all vital data of the given patient
    static async getVitalData(patientId) {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAdress');
        const token = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken');

        console.log(patientId);
        return await fetch(url + '/api/zeitdaten/vitalwert/list', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Token': token,
            },
        })
        .then(response => {
            if (!response.ok) {
                throw Object.assign({status: response.status, message: response.statusText});
            }

            return response.json();
        })
        .then(res => {
            const data = this.parseVitalData(res, patientId);
            return {data: data, status: 200};
        })
        .catch((error) => {
            if (typeof error === "object") {
                return {status: error.status, data: {message: error.message}};
            } else {
                console.error(error);
            }
        });
    }

    static parseVitalData(data, patientId) {
        const res = {
          bloodpressure: {date: '', values: {systolic: '', diastolic: ''}},
          pulse: {date: '', value: ''},
          temperature: {date: '', value: ''},
          sugar: {date: '', value: ''},
          weight: {date: '', value: ''},
          spo2: {date: '', value: ''},
        };

        for (let i=0; i<data.length; i++) {
            //check patient id
            if (data[i].PID != patientId) {
                continue;
            }

            const tzoffset = (new Date(data[i].Datum)).getTimezoneOffset() * 60000; //offset in milliseconds
            const date = (new Date(new Date(data[i].Datum) - tzoffset)).toISOString().slice(0, -1);

            switch (data[i].ArtID) {
                case '655.1138': // bloodpressure
                    if (!res.bloodpressure.date || new Date(date) > new Date(res.bloodpressure.date)) {
                        res.bloodpressure.values.systolic = data[i].Wert1.split("/")[0];
                        res.bloodpressure.values.diastolic = data[i].Wert1.split("/")[1];
                        res.bloodpressure.date = date;
                    }
                    break;
                case '656.1137': // blood sugar (mg/dl), ignoring 656.1135' blood sugar (mmol/dl)
                    if (!res.sugar.date || new Date(date) > new Date(res.sugar.date)) {
                        res.sugar.value = data[i].Wert1;
                        res.sugar.date = date;
                    }
                    break;
                case '658.1144': // weight
                    if (!res.weight.date || new Date(date) > new Date(res.weight.date)) {
                        res.weight.value = data[i].Wert1;
                        res.weight.date = date;
                    }
                    break;
                case '660.1155': // pulse
                    if (!res.pulse.date || new Date(date) > new Date(res.pulse.date)) {
                        res.pulse.value = data[i].Wert1;
                        res.pulse.date = date;
                    }
                    break;
                case '1133.28': // spo2
                    if (!res.spo2.date || new Date(date) > new Date(res.spo2.date)) {
                        res.spo2.value = data[i].Wert1;
                        res.spo2.date = date;
                    }
                    break;
                case '662.1149': // temperature
                    if (!res.temperature.date || new Date(date) > new Date(res.temperature.date)) {
                        res.temperature.value = data[i].Wert1;
                        res.temperature.date = date;
                    }
                    break;
            }
        }

        return res;
    }

    static async getLastDefecation(patientId) {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAdress');
        const token = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken');

        return await fetch(url + '/api/v2/Bericht?KlientIds=' + patientId, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Auth-Token': token,
            },
        })
        .then(response =>
            response.json().then(data => ({
                  data: data,
                  status: response.status,
              }),
            ).then(res => {
                console.log(res);
                if (res.status == 200) {
                    return {
                        date: new Date(res.data.Vitalwerte[res.data.Vitalwerte.length - 1].Datum)
                                .toISOString().split('Z')[0],
                        value: res.data.Vitalwerte[res.data.Vitalwerte.length - 1].Wert.replace(',', '.'),
                    };
                } else {
                    return {date: '', value: ''};
                }
            }),
        )
        .catch((error) => {
            console.error('Error:', error);
            return {date: '', value: ''};
        });
    }
}
