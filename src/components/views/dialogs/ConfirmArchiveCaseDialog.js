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
import sdk from "../../../index";

export default class ConfirmArchiveCaseDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        room: PropTypes.object.isRequired,
    };

    _onConfirm = () => {
        this.props.onFinished(true);
    };

    _onDecline = () => {
        this.props.onFinished(false);
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className='amp_ConfirmArchiveCaseDialog' hasCancel={true}
                        onFinished={this.props.onFinished}
                        title={_t("Archive case?")}>
                <div className='amp_ConfirmArchiveCaseDialog_content'>
                    <p>
                        {_t(
                            "After archiving the case all the included data will not be accesible anymore.",
                        )}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("Archive case")}
                    onPrimaryButtonClick={this._onConfirm}
                    primaryButtonClass="danger"
                    cancelButton={_t("Cancel")}
                    onCancel={this._onDecline}
                />

            </BaseDialog>
        );
    }
}
