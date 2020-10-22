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
import {SettingLevel} from "../settings/SettingLevel";

export default class Vivendi {
    /**
     * Test connection to the Vivendi API
     * @param {String} url The URL of the API for the third party software
     * @param {String} success Callback function for successful connection test
     * @param {String} failure Callback function for connection failure
     */
    static testInterface(url, success, failure) {
        fetch(url + '/api/v2/LoginUser', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        })
        .then(function(response) {
            if (response.status == 400) {
                return response.json();
            } else {
                failure(response.status + " " + response.statusText);
                return;
            }
        })
        .then(function(responseAsJson) {
            if (responseAsJson) {
                if (responseAsJson == "Auth-Request enthält keinen AuthenticationHeader") {
                    success();
                } else {
                    failure();
                }
            }
        })
        .catch(failure);
    }

    // Authorization method of the external api
    static getLoginMethod() {
        return 'user';
    }

    /**
     * Login to the Vivendi API
     * @param {String} username The username from Vivendi
     * @param {String} password The password for the Vivendi user
     * @return {Object} Result from the login API in json format
     */
    static async login(username, password) {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAddress');
        const body = {username: username, password: password, userGroupType: 3};
        const response = await fetch(url + '/api/v2/LoginUser', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Authentication': JSON.stringify(body),
            },
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
            SettingsStore.setValue("ampInterfacesUsername", null, SettingLevel.DEVICE, username);
            SettingsStore.setValue("ampInterfacesToken", null, SettingLevel.DEVICE, res.data);
            return {data: {username: username, token: res.data}, status: res.status};
        })
        .catch((error) => {
            if (typeof error === "object") {
                return {status: error.status, data: {message: error.data}};
            } else {
                console.error(error);
            }
        });

        return response;
    }

    static getUserName() {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesUsername');
    }

    // Loads the list of associated patients
    static async getPatients() {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAddress');
        const token = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken');

        return await fetch(url + '/api/v2/Klient/SucheNachZeitraum?MitDetails=true', {
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
                if (!res.data.Klienten) {
                    if (res.data.Message) {
                        return {status: res.status, data: {message: res.data.Message}};
                    }
                    return res;
                }
                const values = {data: [], status: res.status};
                for (let i=0; i<res.data.Klienten.length; i++) {
                    const value = {};
                    value.id = res.data.Klienten[i].Id;
                    value.gender = res.data.Klienten[i].Geschlecht ? 'male' : 'female';
                    if (res.data.Klienten[i].Geburtsdatum) {
                        value.birthday = res.data.Klienten[i].Geburtsdatum.split('T')[0];
                    }
                    value.givenName = res.data.Klienten[i].Vorname;
                    value.name = res.data.Klienten[i].Name;
                    values.data[i] = value;
                }
                return values;
            }),
        )
        .catch((error) => {
            console.error('Error:', error);
        });
    }

    // Collect all vital data of the given patient
    static async getVitalData(patientId) {
        const [
          bloodpressure,
          pulse,
          temperature,
          sugar,
          weight,
          spo2,
        ] = await Promise.all([
          this.getBloodpressure(patientId),
          this.getPulse(patientId),
          this.getTemperature(patientId),
          this.getSugar(patientId),
          this.getWeight(patientId),
          this.getSpO2(patientId),
          this.getLastDefecation(patientId),
        ]);

        const res = {
          bloodpressure: {date: bloodpressure.date,
                          values: {
                            systolic: bloodpressure.values.sys,
                            diastolic: bloodpressure.values.dia,
                          },
                        },
          pulse: {date: pulse.date, value: pulse.value},
          temperature: {date: temperature.date, value: temperature.value},
          sugar: {date: sugar.date, value: sugar.value},
          weight: {date: weight.date, value: weight.value},
          spo2: {date: spo2.date, value: spo2.value},
        };
        return {data: res, status: 200};
    }

    static async getBloodpressure(patientId) {
      const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAddress');
      const token = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken');

      return await fetch(url + '/api/v2/Vitalwert?KategorieIds=1&KlientIds=' + patientId, {
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
              if (res.status == 200) {
                  return {
                      date: new Date(res.data.Vitalwerte[res.data.Vitalwerte.length - 1].Datum)
                                .toISOString()
                                .split('Z')[0],
                      values: {
                          sys: res.data.Vitalwerte[res.data.Vitalwerte.length - 1].Werte[0],
                          dia: res.data.Vitalwerte[res.data.Vitalwerte.length - 1].Werte[1],
                      },
                  };
              } else {
                  return {date: '', value: ''};
              }
          }),
      )
      .catch((error) => {
          console.error('Error:', error);
          return {date: '', values: {sys: '', dia: ''}};
      });
    }

    static async getPulse(patientId) {
        return await this.getVitalValue(patientId, 4);
    }

    static async getTemperature(patientId) {
        return await this.getVitalValue(patientId, 3);
    }

    static async getSugar(patientId) {
        return await this.getVitalValue(patientId, 2);
    }

    static async getWeight(patientId) {
        return await this.getVitalValue(patientId, 5);
    }

    static async getSpO2(patientId) {
        return await this.getVitalValue(patientId, 12);
    }

    static async getLastDefecation(patientId) {
        // date of last defecation could be retrieved from the reports but isn't implemented correctly yet
        return {date: '', value: ''};

        /*
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAddress');
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
                                  .toISOString()
                                  .split('Z')[0],
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
        */
    }

    // Loads vital data for a given patient
    static async getVitalValue(patientId, category) {
        const url = SettingsStore.getValueAt(SettingLevel.ACCOUNT, 'ampInterfacesAddress');
        const token = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesToken');

        return await fetch(url + '/api/v2/Vitalwert?KategorieIds=' + category + '&KlientIds=' + patientId, {
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
                if (res.status == 200) {
                    return {
                        date: new Date(res.data.Vitalwerte[res.data.Vitalwerte.length - 1].Datum)
                                  .toISOString()
                                  .split('Z')[0],
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
