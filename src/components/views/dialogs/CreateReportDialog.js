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

import React from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import * as sdk from "../../../index";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { formatFullDateNoTime } from "../../../DateUtils";
import { drawDOM, exportPDF } from "@progress/kendo-drawing";
import { PDFExport } from "@progress/kendo-react-pdf";
import * as JSZip from "jszip";
import { saveAs } from "file-saver";
import { decryptFile } from "../../../utils/DecryptFile";
import ErrorDialog from "./ErrorDialog";

export default class CreateReportDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        room_id: PropTypes.string,
    };

    constructor(props) {
        super(props);

        this.state = {
            fileList: [],
            messages: "",
            loadingFormData: false,
            form_data: null,
        };

        this.ref = null;
    }

    componentDidMount() {
        this.setState({
            messages: this.getMessages(this.props.room_id),
        });

        // load form data from synapse
        const client = MatrixClientPeg.get();
        let result = client._http
            .authedRequest(
                undefined,
                "GET",
                "/_matrix/amp/form",
                {},
                {},
                { prefix: "" }
            )
            .catch((e) => {
                console.error(e);
                return null; // otherwise consume the error
            })
            .then((r) => {
                if (!r) r = {};
                this.setState({ form_data: r, loadingFormData: false });
            });
    }

    onOk = async () => {
        // archive case
        const room = MatrixClientPeg.get().getRoom(this.props.room_id);
        const roomName = room.name;

        // generate filenames
        let zipFileName = "Archiv.zip";
        let pdfFileName = "Report.pdf";
        if (roomName !== "") {
            zipFileName = roomName + " - Archiv.zip";
            pdfFileName = roomName + " - Report.pdf";
        }

        // build zip file
        const zip = new JSZip();

        // add all files
        for (let i = 0; i < this.state.fileList.length; i++) {
            const blob = this.decryptFile(this.state.fileList[i].content);
            zip.file(this.state.fileList[i].content.body, blob);
        }

        await drawDOM(ReactDOM.findDOMNode(this.container), {
            paperSize: "A4",
            creator: "AMP.care",
            producer: "AMP.care",
            fileName: pdfFileName,
            margin: "10mm",
        })
            .then((group) => {
                return exportPDF(group);
            })
            .then((dataUri) => {
                const blob = this.b64toBlob(
                    dataUri.split(";base64,")[1],
                    "application/pdf"
                );
                zip.file(pdfFileName, blob);
            });

        // preserve `this` for the `then` function
        const that = this;

        // Generate the zip file asynchronously
        await zip.generateAsync({ type: "blob" }).then(function (content) {
            // force download of the zip file
            saveAs(content, zipFileName);
            that.props.onFinished(true);
        });
    };

    onCancel = () => {
        this.props.onFinished(false);
    };

    decryptFile = (content) => {
        return decryptFile(content.file).catch((err) => {
            console.warn("Unable to decrypt attachment: ", err);
            Modal.createTrackedDialog(
                "Error decrypting attachment",
                "",
                ErrorDialog,
                {
                    title: _t("Error"),
                    description: _t("Error decrypting attachment"),
                }
            );
        });
    };

    b64toBlob = (b64Data, contentType = "", sliceSize = 512) => {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (
            let offset = 0;
            offset < byteCharacters.length;
            offset += sliceSize
        ) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);

            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: contentType });
        return blob;
    };

    getMessages = (roomId) => {
        const MessageTimestamp = sdk.getComponent("messages.MessageTimestamp");
        const room = MatrixClientPeg.get().getRoom(roomId);
        const messages = room.getUnfilteredTimelineSet().room.timeline;

        const res = [];

        const timeline = [];
        const dataList = [];
        const observationDataList = [];
        const fileList = [];

        let initialDateSeparatorSet = false;

        for (let i = 0; i < messages.length; i++) {
            const event = messages[i];
            let message = "";
            let data = "";
            let observationData = "";

            if (event.event.type === "m.room.encrypted") {
                if (event._clearEvent.type === "m.room.message") {
                    if (
                        event._clearEvent.content.msgtype === "m.bad.encrypted"
                    ) {
                        message = <div>Decryption error</div>;
                    }

                    if (event._clearEvent.content.msgtype === "m.text") {
                        message = (
                            <div key={event.event.event_id}>
                                <MessageTimestamp
                                    showTwelveHour={false}
                                    ts={event.event.origin_server_ts}
                                />
                                &nbsp;&nbsp;
                                {event.sender.name}:{" "}
                                {event._clearEvent.content.body}
                            </div>
                        );
                        // or rawDisplayName ?
                    }

                    if (event._clearEvent.content.msgtype === "m.image") {
                        message = (
                            <div key={event.event.event_id}>
                                <MessageTimestamp
                                    showTwelveHour={false}
                                    ts={event.event.origin_server_ts}
                                />
                                &nbsp;&nbsp;
                                {event.sender.name}: {_t("Image file")} -{" "}
                                {event._clearEvent.content.body}
                            </div>
                        );
                        fileList.push(event._clearEvent);
                    }

                    if (event._clearEvent.content.msgtype === "m.file") {
                        message = (
                            <div key={event.event.event_id}>
                                <MessageTimestamp
                                    showTwelveHour={false}
                                    ts={event.event.origin_server_ts}
                                />
                                &nbsp;&nbsp;
                                {event.sender.name}: {_t("File")} -{" "}
                                {event._clearEvent.content.body}
                            </div>
                        );
                        fileList.push(event._clearEvent);
                    }

                    if (event._clearEvent.content.msgtype === "m.audio") {
                        message = (
                            <div key={event.event.event_id}>
                                <MessageTimestamp
                                    showTwelveHour={false}
                                    ts={event.event.origin_server_ts}
                                />
                                &nbsp;&nbsp;
                                {event.sender.name}: {_t("Audio file")} -{" "}
                                {event._clearEvent.content.body}
                            </div>
                        );
                        fileList.push(event._clearEvent);
                    }

                    if (event._clearEvent.content.msgtype === "m.video") {
                        message = (
                            <div key={event.event.event_id}>
                                <MessageTimestamp
                                    showTwelveHour={false}
                                    ts={event.event.origin_server_ts}
                                />
                                &nbsp;&nbsp;
                                {event.sender.name}: {_t("Video file")} -{" "}
                                {event._clearEvent.content.body}
                            </div>
                        );
                        fileList.push(event._clearEvent);
                    }
                }
            }

            if (event._clearEvent.type === "care.amp.case") {
                data = this.parseCaseData(event._clearEvent.content);
            }
            if (event._clearEvent.type === "care.amp.patient") {
                data = this.parsePatientData(event._clearEvent.content);
            }
            if (event._clearEvent.type === "care.amp.observation") {
                const vitalData = this.parseVitalData(
                    event._clearEvent.content
                );
                const anamnesisData = this.parseAnamnesisData(
                    event._clearEvent.content
                );
                observationData = vitalData.concat(anamnesisData);
            }

            if (message != "") {
                if (
                    !initialDateSeparatorSet ||
                    (i > 0 &&
                        this.wantsDateSeparator(
                            messages[i - 1].event.origin_server_ts,
                            messages[i].event.origin_server_ts
                        ))
                ) {
                    initialDateSeparatorSet = true;
                    const dateSeparator = this.getDateSeparator(
                        messages[i].event.origin_server_ts
                    );
                    timeline.push(dateSeparator);
                }
                timeline.push(message);
            }

            if (data != "") {
                dataList.push(data);
            }

            if (observationData != "") {
                observationDataList.push(observationData);
            }
        }

        if (dataList.length > 0) {
            res.push(dataList);
        }

        if (observationDataList.length > 0) {
            res.push(observationDataList);
        }

        if (timeline.length > 0) {
            res.push(<h2 key="messages">{_t("Messages")}</h2>);
            res.push(timeline);
        }

        this.setState({
            fileList: fileList,
        });

        return res;
    };

    getDateSeparator = (ts) => {
        const date = new Date(ts);

        return (
            <h2
                className="mx_DateSeparator"
                role="separator"
                tabIndex={-1}
                key={ts}
            >
                <hr role="none" />
                <div>{formatFullDateNoTime(date)}</div>
                <hr role="none" />
            </h2>
        );
    };

    wantsDateSeparator = (prevEventDate, nextEventDate) => {
        const MILLIS_IN_DAY = 86400000;
        if (!nextEventDate || !prevEventDate) {
            return false;
        }
        // Return early for events that are > 24h apart
        if (Math.abs(prevEventDate - nextEventDate) > MILLIS_IN_DAY) {
            return true;
        }

        return false;
    };

    formatDate = (dateString) => {
        if (dateString === "") return "";

        let givenDate;
        if (dateString === "now") {
            givenDate = new Date();
        } else {
            givenDate = new Date(dateString);
        }
        const ret = givenDate.toISOString();
        return ret;
    };

    parseAndFormatJson = (data) => {
        const results = [];
        if (this.state.form_data) {
            const json = this.state.form_data.form;

            for (let i = 0; i < json.length; i++) {
                json[i].forEach((item, index) => {
                    if (item.group === "case") {
                        if (data[item.name]) {
                            results.push({
                                name: item.name,
                                type: item.type,
                                subtype: item.type_annotation,
                                label: item.label,
                                value: data[item.name],
                            });
                        }
                    }
                });
            }

            for (let i = 0; i < results.length; i++) {
                // format dates
                if (
                    results[i].type == "Textline" &&
                    results[i].subtype == "date"
                ) {
                    const date = new Date(results[i].value);
                    results[i].value = date.toLocaleDateString();
                }

                // translate items from dropdowns
                if (results[i].type == "Dropdown") {
                    results[i].value = results[i].value;
                }

                // convert booleans
                if (results[i].type == "SingleSelect") {
                    results[i].value =
                        results[i].value == true ? _t("Yes") : _t("No");
                }
            }
        }

        return results;
    };

    parseCaseData = (event) => {
        const caseItems = this.parseAndFormatJson(event);

        // case data
        const caseData = caseItems.map((item, index) => (
            <tr key={item.label + index}>
                <td>{item.label}:</td>
                <td>{item.value}</td>
            </tr>
        ));

        return (
            <div>
                <h2 key="case_data">{_t("Case")}</h2>
                <table className="amp_ReportTable" key="amp_report_case_data">
                    <tbody>{caseData}</tbody>
                </table>
            </div>
        );
    };

    parsePatientData = (event) => {
        const renderItems = this.parseAndFormatJson(event);

        // patient data
        const patientData = renderItems.map((item) => (
            <tr key={item.label}>
                <td>{item.label}:</td>
                <td>{item.value}</td>
            </tr>
        ));

        return (
            <div>
                <h2 key="patient_data">{_t("Patient data")}</h2>
                <table
                    className="amp_ReportTable"
                    key="amp_report_patient_data"
                >
                    <tbody>{patientData}</tbody>
                </table>
            </div>
        );
    };

    parseVitalData = (event) => {
        const vitalItems = this.parseAndFormatJson(event);

        // vital data
        const vitalData = vitalItems.map((item) => (
            <tr key={item.label}>
                <td>{item.label}:</td>
                <td>{item.value}</td>
            </tr>
        ));

        return (
            <div>
                <h2 key="vital_data">{_t("Vital data")}</h2>
                <table className="amp_ReportTable" key="amp_report_vital_data">
                    <tbody>{vitalData}</tbody>
                </table>
            </div>
        );
    };

    parseAnamnesisData = (event) => {
        const anamnesisItems = this.parseAndFormatJson(event);

        // anamnesis data
        const anamnesisData = anamnesisItems.map((item) => (
            <tr key={item.label}>
                <td>{item.label}:</td>
                <td>{item.value}</td>
            </tr>
        ));

        return (
            <div>
                <h2 key="anamnesis_data">{_t("Anamnesis data")}</h2>
                <table
                    className="amp_ReportTable"
                    key="amp_report_anamnesis_data"
                >
                    <tbody>{anamnesisData}</tbody>
                </table>
            </div>
        );
    };

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
        const DialogButtons = sdk.getComponent("views.elements.DialogButtons");
        const now =
            new Date().toLocaleDateString() +
            " - " +
            new Date().toLocaleTimeString();

        console.log(this.props.formData);

        return (
            <BaseDialog
                className="amp_CreateReportDialog"
                onFinished={this.props.onFinished}
                title={_t("Create report")}
            >
                <div className="amp_report_page">
                    <PDFExport
                        paperSize={"A4"}
                        fileName="Report.pdf"
                        title=""
                        subject=""
                        keywords=""
                        ref={(r) => (this.ref = r)}
                    >
                        <div ref={(container) => (this.container = container)}>
                            <table>
                                <tbody>
                                    <tr key="amp_report_header">
                                        <td key="amp_report_logo" rowSpan="2">
                                            <img
                                                src={require("../../../../res/img/amp.svg")}
                                                height="80"
                                                alt="AMP Logo"
                                            />
                                        </td>
                                        <td
                                            key="amp_report_heading"
                                            style={{ paddingRight: "20px" }}
                                        >
                                            <h1>AMP.care {_t("Report")}</h1>
                                        </td>
                                    </tr>
                                    <tr key="amp_report_subheader">
                                        <td
                                            key="amp_report_subheading"
                                            style={{
                                                position: "relative",
                                                top: "-25px",
                                            }}
                                        >
                                            {_t("created at")}&nbsp;{now}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div>{this.state.messages}</div>
                        </div>
                    </PDFExport>
                </div>

                <DialogButtons
                    primaryButton={_t("Save report")}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel}
                />
            </BaseDialog>
        );
    }
}
