/*
Copyright 2019, 2020 Awesome Technologies Innovationslabor GmbH

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
import {_t} from "../../../languageHandler";
import * as sdk from "../../../index";

export default createReactClass({
    displayName: 'ConfirmCloseCaseDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    _onOk: function() {
        this.props.onFinished(true);
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className='amp_ConfirmCloseCaseDialog' hasCancel={true}
                        onFinished={this.props.onFinished}
                        title={_t("Close case?")}>
                <div className='amp_ConfirmCloseCaseDialog_content'>
                    <p>
                        {_t(
                            "Closing the case is permanent. After closing the case will not be editable anymore."
                        )}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("Close case")}
                    onPrimaryButtonClick={this._onOk}
                    primaryButtonClass="danger"
                    cancelButton={_t("Cancel")}
                    onCancel={this._onCancel}
                />
            </BaseDialog>
          );
      },
  });
