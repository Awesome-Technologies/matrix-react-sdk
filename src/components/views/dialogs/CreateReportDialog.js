/*
Copyright 2020 Michael Albert - Awesome Technologies Innovationslabor GmbH

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
import ReactDOM from 'react-dom';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import Modal from "../../../Modal";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import colorVariables from '../../../../res/themes/light/css/light.scss';
import { formatFullDateNoTime } from '../../../DateUtils';
import { PDFExport, savePDF } from "@progress/kendo-react-pdf";
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { decryptFile } from '../../../utils/DecryptFile';

export default createReactClass({
    displayName: 'CreateReportDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
        room_id: PropTypes.string,
    },
    ref: null,

    getInitialState: function() {
        return {
            fileList: [],
            messages: '',
        };
    },

    getDefaultProps: function() {
        return {
            room_id: null,
        };
    },

    componentDidMount: function() {
        this.setState({
            messages: this._getMessages(this.props.room_id),
        });
    },

    _onOk: async function() {
        // archive case
        const room = MatrixClientPeg.get().getRoom(this.props.room_id);
        const roomName = room.name;

        // build zip file
        var zip = new JSZip();

        // add all files
        for (let i = 0; i < this.state.fileList.length; i++) {
            const blob = this._decryptFile(this.state.fileList[i].content);
            zip.file(this.state.fileList[i].content.body, blob);
        }

        // generate filenames
        var zipFileName = "Archiv.zip";
        var pdfFileName = "Report.pdf";
        if (roomName !== '') {
            zipFileName = roomName + " - Archiv.zip";
            pdfFileName = roomName + " - Report.pdf";
        }


        // Generate the zip file asynchronously
        await zip.generateAsync({type:"blob"})
        .then(function(content) {
            // force download of the zip file
            saveAs(content, zipFileName);
        });

        // save pdf to filesystem
        var res;
        savePDF(ReactDOM.findDOMNode(this.container), {
            paperSize: 'A4',
            creator: 'AMP.care',
            producer: 'AMP.care',
            fileName: pdfFileName,
            margin: '10mm',
        }, this._onFileSaved);

        console.log("pdf created")
    },

    _onFileSaved: function() {
        this.props.onFinished(true);
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    _decryptFile: function(content) {
        return decryptFile(content.file).catch((err) => {
            console.warn("Unable to decrypt attachment: ", err);
            Modal.createTrackedDialog('Error decrypting attachment', '', ErrorDialog, {
                title: _t("Error"),
                description: _t("Error decrypting attachment"),
            });
        });
    },

    _getMessages: function(roomId) {
        const MessageTimestamp = sdk.getComponent('messages.MessageTimestamp');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const room = MatrixClientPeg.get().getRoom(roomId);
        const messages = room.getUnfilteredTimelineSet().room.timeline;

        var res = [];

        var timeline = [];
        var dataList = [];
        var observationDataList = [];
        var fileList = [];

        var initialDateSeparatorSet = false;

        for (let i = 0; i < messages.length; i++) {
            const event = messages[i];
            var message = '';
            var data = '';
            var observationData = '';

            if (event.event.type === "m.room.encrypted") {
                if (event._clearEvent.type === "m.room.message") {
                    if (event._clearEvent.content.msgtype === "m.bad.encrypted") {
                        message = <div>Decryption error</div>;
                    }

                    if (event._clearEvent.content.msgtype === "m.text") {
                        message = <div key={event.event.event_id}>
                                    <MessageTimestamp showTwelveHour={false} ts={event.event.origin_server_ts} />
                                    &nbsp;&nbsp;
                                    {event.sender.name}: {event._clearEvent.content.body}
                                  </div>;
                        // or rawDisplayName ?
                    }

                    if (event._clearEvent.content.msgtype === "m.image") {
                        message = <div key={event.event.event_id}>
                                    <MessageTimestamp showTwelveHour={false} ts={event.event.origin_server_ts} />
                                    &nbsp;&nbsp;
                                    {event.sender.name}: {_t("Image file")} - {event._clearEvent.content.body}
                                  </div>;
                        fileList.push(event._clearEvent);
                    }

                    if (event._clearEvent.content.msgtype === "m.file") {
                        message = <div key={event.event.event_id}>
                                    <MessageTimestamp showTwelveHour={false} ts={event.event.origin_server_ts} />
                                    &nbsp;&nbsp;
                                    {event.sender.name}: {_t("File")} - {event._clearEvent.content.body}
                                  </div>;
                        fileList.push(event._clearEvent);
                    }

                    if (event._clearEvent.content.msgtype === "m.audio") {
                        message = <div key={event.event.event_id}>
                                    <MessageTimestamp showTwelveHour={false} ts={event.event.origin_server_ts} />
                                    &nbsp;&nbsp;
                                    {event.sender.name}: {_t("Audio file")} - {event._clearEvent.content.body}
                                  </div>;
                        fileList.push(event._clearEvent);
                    }

                    if (event._clearEvent.content.msgtype === "m.video") {
                        message = <div key={event.event.event_id}>
                                    <MessageTimestamp showTwelveHour={false} ts={event.event.origin_server_ts} />
                                    &nbsp;&nbsp;
                                    {event.sender.name}: {_t("Video file")} - {event._clearEvent.content.body}
                                  </div>;
                        fileList.push(event._clearEvent);
                    }
                }
            }

            if (event._clearEvent.type === "care.amp.case") {
                data = this._parseCaseData(event._clearEvent.content);
            }
            if (event._clearEvent.type === "care.amp.patient") {
                data = this._parsePatientData(event._clearEvent.content);
            }
            if (event._clearEvent.type === "care.amp.observation") {
                observationData = this._parseObservationData(event._clearEvent.content);
            }

            if (message != '') {
                if (!initialDateSeparatorSet || i>0 && this._wantsDateSeparator(messages[i-1].event.origin_server_ts, messages[i].event.origin_server_ts)) {
                    initialDateSeparatorSet = true;
                    const dateSeparator = this._getDateSeparator(messages[i].event.origin_server_ts);
                    timeline.push(dateSeparator);
                }
                timeline.push(message);
            }

            if (data != '') {
                dataList.push(data);
            }

            if (observationData != '') {
                observationDataList.push(observationData);
            }
        }

        if (dataList.length > 0) {
            res.push(dataList);
        }

        if (observationDataList.length > 0) {
            res.push(<h2 key="data">{_t("Vital data")}/{_t("Anamnesis")}</h2>);
            res.push(<table className="amp_ReportTable" key="amp_report_observation_data"><tbody>{observationDataList}</tbody></table>);
        }

        if (timeline.length > 0) {
            res.push(<h2 key="messages">{_t("Messages")}</h2>);
            res.push(timeline);
        }

        this.setState({
            fileList: fileList,
        });

        return res;
    },

    _getDateSeparator: function(ts) {
        const date = new Date(ts);

        return <h2 className="mx_DateSeparator" role="separator" tabIndex={-1} key={ts}>
            <hr role="none" />
            <div>{ formatFullDateNoTime(date) }</div>
            <hr role="none" />
        </h2>
    },

    _wantsDateSeparator: function(prevEventDate, nextEventDate) {
        const MILLIS_IN_DAY = 86400000;
        if (!nextEventDate || !prevEventDate) {
            return false;
        }
        // Return early for events that are > 24h apart
        if (Math.abs(prevEventDate - nextEventDate) > MILLIS_IN_DAY) {
            return true;
        }

        return false;
    },

    _formatDate: function(dateString) {
        if (dateString === '') return '';

        let givenDate;
        if (dateString === 'now') {
            givenDate = new Date();
        } else {
            givenDate = new Date(dateString);
        }
        const ret = givenDate.toISOString();
        return ret;
    },

    _parseCaseData: function(event) {
        // case data
        return <div>
            <h2 key="case_data">{_t("Case")}</h2>
            <table className="amp_ReportTable" key="amp_report_case_data"><tbody>
                <tr key="amp_report_case_title"><td>{_t("Title")}:</td><td>{event.title}</td></tr>
                <tr key="amp_report_case_message"><td>{_t("Message")}:</td><td>{event.note}</td></tr>
                <tr key="amp_report_case_severity"><td>{_t("Severity")}:</td><td>{_t(event.severity)}</td></tr>
                <tr key="amp_report_case_requester"><td>{_t("Requester")}:</td><td>{event.requester.reference}</td></tr>
            </tbody></table>
        </div>;
    },

    _parsePatientData: function(event) {
        // patient data
        const date = new Date(event.birthDate);
        const patientBirthdate = date.toLocaleDateString();

        return <div>
            <h2 key="patient_data">{_t("Patient data")}</h2>
            <table className="amp_ReportTable" key="amp_report_patient_data"><tbody>
                <tr key="amp_report_patient_name"><td>{_t("Patient name")}:</td><td>{event.name}</td></tr>
                <tr key="amp_report_patient_gender"><td>{_t("Gender")}:</td><td>{_t(event.gender)}</td></tr>
                <tr key="amp_report_patient_birthday"><td>{_t("Birthday")}:</td><td>{patientBirthdate}</td></tr>
            </tbody></table>
        </div>;
    },

    _parseObservationData: function(event) {
        const res = [];

        const date = new Date(event.effectiveDateTime);
        const datetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();


        res.push(<td key="amp_report_{event.id}_event">{_t(event.id)}:</td>);

        switch (event.id) {
            // anamnesis data
            case 'responsiveness':
            case 'pain':
            case 'misc':
                res.push(<td key="amp_report_{event.id}_value">{event.valueString}</td>);
                break;
            case 'last-defecation':
                break;
            // vital data
            case 'body-weight':
            case 'body-temperature':
            case 'glucose':
            case 'heart-rate':
            case 'oxygen':
                res.push(<td key="amp_report_{event.id}_value">{event.valueQuantity.value} {event.valueQuantity.unit}</td>);
                break;
            case 'blood-pressure':
                res.push(<td key="amp_report_{event.id}_value">{event.component[0].valueQuantity.value} {event.component[0].valueQuantity.unit} / {event.component[1].valueQuantity.value} {event.component[1].valueQuantity.unit}</td>);
                break;
        }

        res.push(<td key="amp_report_{event.id}_datetime">{datetime}</td>);
        return (<tr key={event.id}>{res}</tr>);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const now = new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString();

        return (
            <BaseDialog className="amp_CreateReportDialog" onFinished={this.props.onFinished}
                title={_t('Create report')}
            >
                <div className="amp_report_page">
                    <PDFExport
                          paperSize={"A4"}
                          fileName="Report.pdf"
                          title=""
                          subject=""
                          keywords=""
                          ref={(r) => this.ref = r}>
                            <div ref={container => (this.container = container)}>
                              <table>
                                <tbody>
                                  <tr key="amp_report_header">
                                    <td key="amp_report_logo" rowSpan="2"><img src={require("../../../../res/img/amp.svg")} height="80" alt='AMP Logo'/></td>
                                    <td key="amp_report_heading" style={{paddingRight: "20px"}}><h1>AMP.care {_t('Report')}</h1></td>
                                  </tr>
                                  <tr key="amp_report_subheader"><td key="amp_report_subheading" style={{position: "relative", top: "-25px"}}>{_t('created at')}&nbsp;{now}</td></tr>
                                </tbody>
                              </table>
                              <div>
                                { this.state.messages }
                              </div>
                            </div>
                    </PDFExport>
                </div>

                <DialogButtons primaryButton={_t('Save report')}
                    onPrimaryButtonClick={this._onOk}
                    onCancel={this._onCancel} />
            </BaseDialog>
        );
    },
});
