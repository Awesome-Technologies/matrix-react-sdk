/*
Copyright 2018 New Vector Ltd

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
import QuestionDialog from './QuestionDialog';
import { _t } from '../../../languageHandler';

export default (props) => {
    const supportUrl = `mailto:support@amp.care` +
        `?subject=AMP.care%20Supportanfrage` +
        `&body=%0D%0A%0D%0A%0D%0AFehlerbeschreibung:`;

    const description1 =
        _t("If you run into any bugs or have feedback you'd like to share, " +
           "please let us know.");
    const description2 = _t("You can <supportMail>write to our support hotline</supportMail> " +
        "to get help or provide feedback. Please add contact information for us to reach out " +
        "to you and try to describe the error or feedback as detailed as possible.", {},
        {
            supportMail: (sub) => {
                return <a target="_blank" rel="noreferrer noopener" href={supportUrl}>{ sub }</a>;
            },
        });

    return (<QuestionDialog
        hasCancelButton={false}
        title={_t("Report bugs & give feedback")}
        description={<div><p>{description1}</p><p>{description2}</p></div>}
        button={_t("Go back")}
        onFinished={props.onFinished}
    />);
};
