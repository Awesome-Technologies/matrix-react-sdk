/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';
import * as Lifecycle from '../../../Lifecycle';
import AuthPage from "../../views/auth/AuthPage";
import SettingsStore from "../../../settings/SettingsStore";
import {SettingLevel} from "../../../settings/SettingLevel";
import ExternalInterface from "../../../interfaces/externalInterface";

const LOGIN_VIEW = {
    LOADING: 1,
    PIN: 2,
    USER: 3,
};

export default class PinOverlay extends React.Component {
    static propTypes = {
        // Query parameters from MatrixChat
        realQueryParams: PropTypes.object, // {homeserver, identityServer, loginToken}
    };

    constructor() {
        super();

        this.state = {
            loginView: LOGIN_VIEW.LOADING,

            busy: false,
            username: "",
            password: "",
            pin: "",
            errorText: "",
            interfaceEnabled: false,
            vendor: "",
        };
    }

    componentDidMount(): void {
        // We've ended up here when we don't need to - navigate to last screen
        if (!Lifecycle.isPinOverlay()) {
            dis.dispatch({action: "view_last_screen"});
            return;
        }
        this._initLogin();
    }

    _initLogin() {
        const loginMethod = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesLoginMethod');
        const interfaceEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesEnabled');
        const vendor = SettingsStore.getValueAt(SettingLevel.DEVICE, 'ampInterfacesVendor');

        this.setState({interfaceEnabled: interfaceEnabled, vendor: vendor});

        if (loginMethod === 'user') {
            console.log("using user/pw view");
            this.setState({loginView: LOGIN_VIEW.USER});
        } else {
            // show pin login by default
            console.log("using pin view");
            this.setState({loginView: LOGIN_VIEW.PIN});
        }
    }

    onPinChange = (ev) => {
        this.setState({pin: ev.target.value});
    };

    onUsernameChange = (ev) => {
        this.setState({username: ev.target.value});
    };

    onPasswordChange = (ev) => {
        this.setState({password: ev.target.value});
    };

    onPinLogin = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({busy: true});

        const res = await ExternalInterface.loginPin(this.state.pin);
        console.log(res);
        if (res) {
            if (res.status === 200) {
                dis.dispatch({action: 'view_last_screen'});
            } else {
                let errorText = _t("Incorrect PIN");
                errorText = res.data.message;
                this.setState({
                    busy: false,
                    errorText: errorText,
                });
                return;
            }
        }
    };

    onPasswordLogin = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({busy: true});

        const res = await ExternalInterface.loginPassword(this.state.username, this.state.password);
        if (res.status != 200) {
            let errorText = _t("Incorrect Username/Password");
            errorText = res.data.message;
            this.setState({
                busy: false,
                errorText: errorText,
            });
            return;
        } else {
            Lifecycle.endPinOverlay();
            //dis.dispatch({action: 'view_last_screen'});
        }
    };

    _renderSignInSection() {
        if (this.state.loginView === LOGIN_VIEW.LOADING) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }

        let error = null;

        const Field = sdk.getComponent("elements.Field");
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        if (this.state.errorText) {
            error = <span className='mx_Login_error'>{this.state.errorText}</span>;
        }

        if (this.state.loginView === LOGIN_VIEW.PIN) {
            let introText = _t("Enter your PIN ");
            if (this.state.interfaceEnabled) {
                if (this.state.vendor === 'vivendi') {
                    introText += _t("from Vivendi ");
                }
                if (this.state.vendor === 'profsys') {
                    introText += _t("from ProfSys ");
                }
            }
            introText += _t(" to unlock.");

            return (
                <form onSubmit={this.onPinLogin}>
                    <p>{introText}</p>
                    {error}
                    <Field
                        id="pin"
                        type="password"
                        label={_t("PIN")}
                        onChange={this.onPinChange}
                        value={this.state.pin}
                        disabled={this.state.busy}
                    />
                    <AccessibleButton
                        onClick={this.onPinLogin}
                        kind="primary"
                        type="submit"
                        disabled={this.state.busy}
                    >
                        {_t("Unlock")}
                    </AccessibleButton>
                </form>
            );
        }

        if (this.state.loginView === LOGIN_VIEW.USER) {
            let introText = _t("Enter your username and password ");
            if (this.state.interfaceEnabled) {
                if (this.state.vendor === 'vivendi') {
                    introText += _t("from Vivendi ");
                }
                if (this.state.vendor === 'profsys') {
                    introText += _t("from ProfSys ");
                }
            }
            introText += _t(" to unlock.");

            return (
                <form onSubmit={this.onPasswordLogin}>
                    <p>{introText}</p>
                    {error}
                    <Field
                        id="username"
                        type="text"
                        label={_t("Username")}
                        onChange={this.onUsernameChange}
                        value={this.state.username}
                        disabled={this.state.busy}
                    />
                    <Field
                        id="password"
                        type="password"
                        label={_t("Password")}
                        onChange={this.onPasswordChange}
                        value={this.state.password}
                        disabled={this.state.busy}
                    />
                    <AccessibleButton
                        onClick={this.onPasswordLogin}
                        kind="primary"
                        type="submit"
                        disabled={this.state.busy}
                    >
                        {_t("Unlock")}
                    </AccessibleButton>
                </form>
            );
        }

        // Default: assume unsupported/error
        return (
            <p>
                {_t(
                    "You cannot sign in to your account. Please contact your " +
                    "homeserver admin for more information.",
                )}
            </p>
        );
    }

    render() {
        const AuthHeader = sdk.getComponent("auth.AuthHeader");
        const AuthBody = sdk.getComponent("auth.AuthBody");

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h2>
                        {_t("Application locked")}
                    </h2>
                    <div>
                        {this._renderSignInSection()}
                    </div>

                </AuthBody>
            </AuthPage>
        );
    }
}
