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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import * as Email from '../../../email';
import AddThreepid from '../../../AddThreepid';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import {MatrixClientPeg} from '../../../MatrixClientPeg';


/**
 * Prompt the user to set a displayname.
 *
 * On success, `onFinished(true)` is called.
 */
export default createReactClass({
    displayName: 'SetDisplaynameDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            displayname: '',
        };
    },

    onDisplaynameChanged: function(value) {
        this.setState({
            displayname: value,
        });
    },

    onSubmit: function() {
        const displayname = this.state.displayname;

        const cli = MatrixClientPeg.get();
        cli.setDisplayName(displayname).catch(function(e) {
            throw new Error("Failed to set display name", e);
        });

        this.props.onFinished(true);
    },

    onCancelled: function() {
        this.props.onFinished(false);
    },

    onEmailDialogFinished: function(ok) {
        if (ok) {
            this.verifyEmailAddress();
        } else {
            this.setState({emailBusy: false});
        }
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const EditableText = sdk.getComponent('elements.EditableText');

        return (
            <BaseDialog className="mx_SetEmailDialog"
                onFinished={this.onCancelled}
                title={this.props.title}
                contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content">
                    <p id='mx_Dialog_content'>
                        { _t('This will allow others to identify you and your account.') }
                    </p>
                    <EditableText
                        initialValue={this.state.displayname}
                        className="mx_SetEmailDialog_email_input"
                        autoFocus="true"
                        placeholder={_t("Displayname")}
                        placeholderClassName="mx_SetEmailDialog_email_input_placeholder"
                        blurToCancel={false}
                        onValueChanged={this.onDisplaynameChanged} />
                </div>
                <div className="mx_Dialog_buttons">
                    <input className="mx_Dialog_primary"
                        type="submit"
                        value={_t("Continue")}
                        onClick={this.onSubmit}
                    />
                    <input
                        type="submit"
                        value={_t("Skip")}
                        onClick={this.onCancelled}
                    />
                </div>
            </BaseDialog>
        );
    },
});
