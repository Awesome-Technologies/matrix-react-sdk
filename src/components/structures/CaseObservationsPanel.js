/*
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
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
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import * as sdk from '../../index';
import {_t} from "../../languageHandler";

import {MatrixClientPeg} from '../../MatrixClientPeg';


/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */

class CaseObservationsPanel extends React.Component {

    static propTypes = {
        // true to give the component a 'display: none' style.
        hidden: PropTypes.bool,

        // true to show a spinner at the top of the timeline to indicate
        // back-pagination in progress
        backPaginating: PropTypes.bool,

        // true to show a spinner at the end of the timeline to indicate
        // forward-pagination in progress
        forwardPaginating: PropTypes.bool,

        // the list of MatrixEvents to display
        events: PropTypes.array.isRequired,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        highlightedEventId: PropTypes.string,

        // Should we show URL Previews
        showUrlPreview: PropTypes.bool,

        // event after which we should show a read marker
        readMarkerEventId: PropTypes.string,

        // whether the read marker should be visible
        readMarkerVisible: PropTypes.bool,

        // the userid of our user. This is used to suppress the read marker
        // for pending messages.
        ourUserId: PropTypes.string,

        // true to suppress the date at the start of the timeline
        suppressFirstDateSeparator: PropTypes.bool,

        // whether to show read receipts
        showReadReceipts: PropTypes.bool,

        // true if updates to the event list should cause the scroll panel to
        // scroll down when we are at the bottom of the window. See ScrollPanel
        // for more details.
        stickyBottom: PropTypes.bool,
        startAtBottom: PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: PropTypes.func,

        // callback which is called when more content is needed.
        onFillRequest: PropTypes.func,

        // className for the panel
        className: PropTypes.string.isRequired,

        // shape parameter to be passed to EventTiles
        tileShape: PropTypes.string,

        // show twelve hour timestamps
        isTwelveHour: PropTypes.bool,

        // show timestamps always
        alwaysShowTimestamps: PropTypes.bool,

        // helper function to access relations for an event
        getRelationsForEvent: PropTypes.func,

        // whether to show reactions for an event
        showReactions: PropTypes.bool,

        // form data for AMP.care
        formData: PropTypes.object,
    }

    componentWillMount() {
        // the event after which we put a visible unread marker on the last
        // render cycle; null if readMarkerVisible was false or the RM was
        // suppressed (eg because it was at the end of the timeline)
        this.currentReadMarkerEventId = null;

        // the event after which we are showing a disappearing read marker
        // animation
        this.currentGhostEventId = null;

        // opaque readreceipt info for each userId; used by ReadReceiptMarker
        // to manage its animations
        this._readReceiptMap = {};

        // Remember the read marker ghost node so we can do the cleanup that
        // Velocity requires
        this._readMarkerGhostNode = null;

        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    /* get the DOM node representing the given event */
    getNodeForEventId = (eventId) => {
        if (!this.eventNodes) {
            return undefined;
        }

        return this.eventNodes[eventId];
    };

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    getReadMarkerPosition = () => {
        const readMarker = this.refs.readMarkerNode;
        const messageWrapper = this.refs.scrollPanel;

        if (!readMarker || !messageWrapper) {
            return null;
        }

        const wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();
        const readMarkerRect = readMarker.getBoundingClientRect();

        // the read-marker pretends to have zero height when it is actually
        // two pixels high; +2 here to account for that.
        if (readMarkerRect.bottom + 2 < wrapperRect.top) {
            return -1;
        } else if (readMarkerRect.top < wrapperRect.bottom) {
            return 0;
        } else {
            return 1;
        }
    };

    isUnmounting = () => {
        return !this._isMounted;
    };

    shouldShowEvent = (mxEv) => {
        // filter for type='care.amp.observation' or state_key='care.amp.patient/care.amp.case'
        if (mxEv.event.state_key === "care.amp.case" || mxEv.event.state_key === "care.amp.patient") {
            return true;
        }

        if (mxEv._clearEvent.type !== undefined) {
            // non state events
            if (mxEv._clearEvent.type === "care.amp.case" || mxEv._clearEvent.type === "care.amp.patient") {
                return true;
            }
            if (mxEv._clearEvent.type === "care.amp.observation") {
                return true;
            }
            if (mxEv._clearEvent.type === "care.amp.done") {
                return true;
            }
        }

        // unencrypted events
        if (mxEv.event.type === "care.amp.observation") {
            return true;
        }
        if (mxEv.event.type === "care.amp.done") {
            return true;
        }

        // ignore everything else
        return false;
    };

    getEventTiles = () => {
        this.eventNodes = {};

        let i;

        // we need to figure out which is the last event we show which isn't
        // a local echo, to manage the read-marker.
        let lastShownEvent;

        for (i = this.props.events.length-1; i >= 0; i--) {
            const mxEv = this.props.events[i];

            if (!this.shouldShowEvent(mxEv)) {
                continue;
            }

            if (lastShownEvent === undefined) {
                lastShownEvent = mxEv;
            }

            if (mxEv.status) {
                // this is a local echo
                continue;
            }

            break;
        }

        const ret = [];
        let caseSeverity = 'info';
        const caseEvents = [];
        const patientEvents = [];
        const observationEvents = [];
        const doneEvents = [];

        const Spinner = sdk.getComponent("elements.Spinner");
        if (!this.props.formData) {
            ret.push(<Spinner w={20} h={20} message={ _t("Loading form...") }  />);
        }

        for (i = 0; i < this.props.events.length; i++) {
          const mxEv = this.props.events[i];

          if (mxEv.event.state_key === "care.amp.case"
           || mxEv.event.type === "care.amp.case"
           || mxEv._clearEvent.type === "care.amp.case") {
            caseEvents.push(mxEv);

            // get case severity
            if (mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined) {
                continue;
            }

            let localEvent = mxEv.event;
            if (mxEv.event.type === 'm.room.encrypted') {
                localEvent = mxEv._clearEvent;
            }
            caseSeverity = localEvent.content.severity;
          }

          if (mxEv.event.state_key === "care.amp.patient"
           || mxEv.event.type === "care.amp.patient"
           || mxEv._clearEvent.type === "care.amp.patient") {
            patientEvents.push(mxEv);
          }

          if (mxEv._clearEvent.type !== undefined) {
            if (mxEv._clearEvent.type === "care.amp.observation") {
                observationEvents.push(mxEv);
            }
            if (mxEv._clearEvent.type === "care.amp.done") {
                doneEvents.push(mxEv);
            }
          }

          // unencrypted events should not occure but are catched anyway
          if (mxEv.event.type === "care.amp.observation") {
            console.error("AMP.care ERROR unencrypted observation events");
            observationEvents.push(mxEv);
          }
          if (mxEv.event.type === "care.amp.done") {
            console.error("AMP.care ERROR unencrypted done events");
            doneEvents.push(mxEv);
          }
        }

        let severityClass = "amp_CaseObservationsPanel_Severity_info";
        switch (caseSeverity) {
            case ('critical'):
                severityClass = "amp_CaseObservationsPanel_Severity_critical";
                break;
            case ('urgent'):
                severityClass = "amp_CaseObservationsPanel_Severity_urgent";
                break;
            case ('request'):
                severityClass = "amp_CaseObservationsPanel_Severity_request";
                break;
        }

        const caseStyle = ( caseEvents.length > 0
                        || patientEvents.length > 0
                        || observationEvents.length > 0 ) ? {} : { display: 'none' };

        // parse case events
        if (caseEvents.length > 0) {
            // show only once
            ret.push(this.parseCaseData(caseEvents[0]));
        }

        // parse patient events
        for (i = 0; i < patientEvents.length; i++) {
            const mxEv = patientEvents[i];
            ret.push(this.parsePatientData(mxEv));
            break; // show only once
        }

        // parse observation events
        ret.push(this.parseObservationData(observationEvents));

        // parse done events
        for (i = 0; i < doneEvents.length; i++) {
            const mxEv = doneEvents[i];
            ret.push(this.parseDone(mxEv));
            break; // show the closed hint only once
        }

        const ScrollPanel = sdk.getComponent("structures.ScrollPanel");

        return <ScrollPanel ref="scrollPanel" className={severityClass}
                    onScroll={this.props.onScroll}
                    onResize={this.onResize}
                    onFillRequest={this.props.onFillRequest}
                    onUnfillRequest={this.props.onUnfillRequest}
                    style={caseStyle}
                    stickyBottom={this.props.stickyBottom}
                    startAtBottom={this.props.startAtBottom}
                    resizeNotifier={this.props.resizeNotifier}>
                    { ret }
                </ScrollPanel>;
    };

    // get a list of read receipts that should be shown next to this event
    // Receipts are objects which have a 'userId', 'roomMember' and 'ts'.
    getReadReceiptsForEvent = (event) => {
        const myUserId = MatrixClientPeg.get().credentials.userId;

        // get list of read receipts, sorted most recent first
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        if (!room) {
            return null;
        }
        const receipts = [];
        room.getReceiptsForEvent(event).forEach((r) => {
            if (!r.userId || r.type !== "m.read" || r.userId === myUserId) {
                return; // ignore non-read receipts and receipts from self.
            }
            if (MatrixClientPeg.get().isUserIgnored(r.userId)) {
                return; // ignore ignored users
            }
            const member = room.getMember(r.userId);
            receipts.push({
                userId: r.userId,
                roomMember: member,
                ts: r.data ? r.data.ts : 0,
            });
        });

        return receipts.sort((r1, r2) => {
            return r2.ts - r1.ts;
        });
    };

    collectEventNode = (eventId, node) => {
        this.eventNodes[eventId] = node;
    };

    parseDone = (mxEv) => {
      // return if event is not decrypted yet
      if (mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined) {
          return;
      }

      if (mxEv.event.type === 'm.room.encrypted') {
          console.log("AMP.care encrypted Event " + mxEv._clearEvent.type);
      } else {
          console.log("AMP.care Event " + mxEv.event.type);
      }
      console.log(mxEv);

      let localEvent = mxEv.event;
      if (mxEv.event.type === 'm.room.encrypted') {
          localEvent = mxEv._clearEvent;
      }

      if (localEvent.type === "care.amp.done") {
          return <div className="amp_CaseObservationsPanel_isClosedWarning">
                      <hr />
                      <span>{_t("This case has been closed. Editing is not possible anymore.")}</span>
                      <hr />
                  </div>;
      }
    };

    parseCaseData = (mxEv) => {
      // return if event is not decrypted yet
      if (mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined) {
          return;
      }

      if (mxEv.event.type === 'm.room.encrypted') {
          console.log("AMP.care encrypted Event " + mxEv._clearEvent.type);
      } else {
          console.log("AMP.care Event " + mxEv.event.type);
      }
      console.log(mxEv);

      let localEvent = mxEv.event;
      if (mxEv.event.type === 'm.room.encrypted') {
          localEvent = mxEv._clearEvent;
      }

      const arrayChunks = [];
      // if the form is already loaded
      if (this.props.formData) {

        const json = this.props.formData.form;

        let renderItems = [];

        for(var i=0; i<json.length; i++) {
          json[i].forEach((item, index) => {
            if (item.group === 'case') {
              if (localEvent.content[item.name]) {
                renderItems.push({name: item.name, type: item.type, subtype: item.type_annotation, label: item.label, value: localEvent.content[item.name]});
              }
            }
          });
        }

        // build styled output render
        const bodyItems = [];
        for (var i=0; i<renderItems.length; i++) {
          // format dates
          if (renderItems[i].type == 'Textline' && renderItems[i].subtype == 'date') {
            const date = new Date(renderItems[i].value);
            renderItems[i].value = date.toLocaleDateString();
          }

          // translate items from dropdowns
          if (renderItems[i].type == 'Dropdown') {
            renderItems[i].value = renderItems[i].value;
          }

          // convert booleans
          if (renderItems[i].type == 'SingleSelect') {
            renderItems[i].value = renderItems[i].value == true ? _t("Yes") : _t("No");
          }

          // print body and header
          bodyItems.push(
          <td style={{ padding: '.5em'}}>
            <span className="amp_CaseObservationsPanel_caseData_header">
              {renderItems[i].label}
            </span>
            <br />
            <span className="amp_CaseObservationsPanel_caseData">
              {renderItems[i].value}
            </span>
          </td>);
        }

        for ( let a = 0; a < bodyItems.length; a += 4) {
          const arrayChunk = bodyItems.slice(a, a + 4);
          arrayChunks.push(arrayChunk);
        }
      }

      return (
        <div className="amp_CaseObservationsPanel_CaseDetails">
          <table className="amp_CaseObservationsPanel_Table">
            <tbody>
              { arrayChunks.map((chunk, index) =>
                <tr key={index}>
                  {chunk.map((item) => item)}
                </tr>,
              )}
            </tbody>
          </table>
        </div>
      );
    };

    parsePatientData = (mxEv) => {
        // return if event is not decrypted yet
        if (mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined) {
            return;
        }

        if (mxEv.event.type === 'm.room.encrypted') {
            console.log("AMP.care encrypted Event " + mxEv._clearEvent.type);
        } else {
            console.log("AMP.care Event " + mxEv.event.type);
        }
        console.log(mxEv);

        let localEvent = mxEv.event;
        if (mxEv.event.type === 'm.room.encrypted') {
            localEvent = mxEv._clearEvent;
        }

        // parse form, select fields of group 'patient'
        // match information of the event with the form fields
        const arrayChunks = [];

        // if form is loaded already
        if (this.props.formData) {
          const json = this.props.formData.form;

          let renderItems = [];

          for(var i=0; i<json.length; i++) {
            json[i].forEach((item, index) => {
              if (item.group === 'patient') {
                if (localEvent.content[item.name]) {
                  console.log("Patient has field " + item.name + " with information " + localEvent.content[item.name]);
                  renderItems.push({name: item.name, type: item.type, subtype: item.type_annotation, label: item.label, value: localEvent.content[item.name]});
                }
              }
            });
          }


          // build styled output render
          const headerItems = [];
          for (let i=0; i<renderItems.length; i++) {
            // format dates
            if (renderItems[i].type == 'Textline' && renderItems[i].subtype == 'date') {
              const date = new Date(renderItems[i].value);
              renderItems[i].value = date.toLocaleDateString();
            }

            // translate items from dropdowns
            if (renderItems[i].type == 'Dropdown') {
              renderItems[i].value = renderItems[i].value;
            }

            // convert booleans
            if (renderItems[i].type == 'SingleSelect') {
              renderItems[i].value = renderItems[i].value == true ? _t("Yes") : _t("No");
            }

            // print body and header
            headerItems.push(
            <td style={{ paddingBottom: '.5em'}}>
              <span className="amp_CaseObservationsPanel_patientData_header">
                {renderItems[i].label}
              </span>
              <br />
              <span className="amp_CaseObservationsPanel_patientData">
                {renderItems[i].value}
              </span>
            </td>);
          }

          for ( let a = 0; a < headerItems.length; a += 4) {
            const arrayChunk = headerItems.slice(a, a + 4);
            arrayChunks.push(arrayChunk);
          }
        }

        return (
            <div className="amp_CaseObservationsPanel_Patient">
                    <table className="amp_CaseObservationsPanel_Table_patientData">
                        <tbody>
                          { arrayChunks.map((chunk, index) =>
                            <tr key={index}>
                              {chunk.map((item) => item)}
                            </tr>,
                          )}
                        </tbody>
                    </table>
              </div>
            );
      };

      parseObservationData = (observationEvents) => {
        let hasVitalData = false;
        let hasAnamnesisData = false;

        let vitalDataBloodPressureSys: '-';
        let vitalDataBloodPressureDia: '-';
        let vitalDataBloodpressureDatetime: '-';
        let vitalDataPulse: '-';
        let vitalDataPulseDatetime: '-';
        let vitalDataTemperature: '-';
        let vitalDataTemperatureDatetime: '-';
        let vitalDataBloodSugar: '-';
        let vitalDataBloodSugarDatetime: '-';
        let vitalDataWeight: '-';
        let vitalDataWeightDatetime: '-';
        let vitalDataOxygen: '-';
        let vitalDataOxygenDatetime: '-';
        let anamnesisDataResponsiveness: '-';
        let anamnesisDataPain: '-';
        let anamnesisDataLastDefecation: '-';
        let anamnesisDataMisc: '-';

        for (let i = 0; i < observationEvents.length; i++) {
            const mxEv = observationEvents[i];

            // return if event is not decrypted yet
            if (mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined) {
                continue;
            }

            if (mxEv.event.type === 'm.room.encrypted') {
                console.log("AMP.care encrypted Event " + mxEv._clearEvent.type);
            } else {
                console.log("AMP.care Event " + mxEv.event.type);
            }
            console.log(mxEv);

            let localEvent = mxEv.event;
            if (mxEv.event.type === 'm.room.encrypted') {
                localEvent = mxEv._clearEvent;
            }

            let date;

            switch (localEvent.content.id) {
                case ('heart-rate'):
                    vitalDataPulse = localEvent.content.valueQuantity.value;
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        vitalDataPulseDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalDataPulseDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case ('glucose'):
                    vitalDataBloodSugar = localEvent.content.valueQuantity.value;
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        vitalDataBloodSugarDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalDataBloodSugarDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case ('body-temperature'):
                    vitalDataTemperature = localEvent.content.valueQuantity.value;
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        vitalDataTemperatureDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalDataTemperatureDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case ('blood-pressure'):
                    vitalDataBloodPressureSys = localEvent.content.component[0].valueQuantity.value;
                    vitalDataBloodPressureDia = localEvent.content.component[1].valueQuantity.value;
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        vitalDataBloodpressureDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalDataBloodpressureDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case ('body-weight'):
                    vitalDataWeight = localEvent.content.valueQuantity.value;
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        vitalDataWeightDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalDataWeightDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case ('oxygen'):
                    vitalDataOxygen = localEvent.content.valueQuantity.value;
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        vitalDataOxygenDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalDataOxygenDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case ('last-defecation'):
                    if (localEvent.content.effectiveDateTime !== ''
                     && localEvent.content.effectiveDateTime !== undefined) {
                        date = new Date(localEvent.content.effectiveDateTime);
                        anamnesisDataLastDefecation = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                        hasAnamnesisData = true;
                    }
                    break;
                case ('misc'):
                    anamnesisDataMisc = localEvent.content.valueString;
                    hasAnamnesisData = true;
                    break;
                case ('responsiveness'):
                    anamnesisDataResponsiveness = localEvent.content.valueString;
                    hasAnamnesisData = true;
                    break;
                case ('pain'):
                    anamnesisDataPain = localEvent.content.valueString;
                    hasAnamnesisData = true;
                    break;
            }
        }

        const vitalDataStyle = hasVitalData ? {} : { display: 'none' };
        const anamnesisStyle = hasAnamnesisData ? {} : { display: 'none' };

        return (
          <div className="amp_CaseObservationsPanel_Observations">
            <div style={vitalDataStyle}>
                  <span className="amp_CaseObservationsPanel_subheading">{_t("Vital data")}</span>
                  <table className="amp_CaseObservationsPanel_Table">
                      <thead>
                          <tr>
                              <th width="25%"></th>
                              <th width="25%"></th>
                              <th width="25%"></th>
                              <th width="25%"></th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("Weight")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataWeight} kg</td>
                              <td>{_t("Temperature")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataTemperature} °C</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataWeightDatetime}</td>
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataTemperatureDatetime}</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Even">
                              <td>{_t("Blood pressure")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataBloodPressureSys} mmHg / {vitalDataBloodPressureDia} mmHg</td>
                              <td>{_t("Blood sugar")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataBloodSugar} mg/dl</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Even">
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataBloodpressureDatetime}</td>
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataBloodSugarDatetime}</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("Pulse")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataPulse} bpm</td>
                              <td>{_t("Oxygen saturation")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataOxygen} %</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataPulseDatetime}</td>
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalDataOxygenDatetime}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              <div style={anamnesisStyle}>
                  <span className="amp_CaseObservationsPanel_subheading">{_t("Anamnesis")}</span>
                      <table className="amp_CaseObservationsPanel_Table">
                          <thead>
                              <tr>
                                  <th width="25%"></th>
                                  <th width="25%"></th>
                                  <th width="25%"></th>
                                  <th width="25%"></th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                                  <td>{_t("Responsiveness")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisDataResponsiveness}</td>
                                  <td>{_t("Pain")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisDataPain}</td>
                              </tr>
                              <tr className="amp_CaseObservationsPanel_TableRow_Even">
                                  <td>{_t("Last defecation")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisDataLastDefecation}</td>
                                  <td>{_t("Misc")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisDataMisc}</td>
                              </tr>
                          </tbody>
                      </table>
                </div>
            </div>
          );
      };

    render() {
        return ( this.getEventTiles() );
    }
}

export default CaseObservationsPanel;
