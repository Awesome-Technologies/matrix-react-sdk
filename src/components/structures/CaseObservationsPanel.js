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
import createReactClass from 'create-react-class';
import classNames from 'classnames';
import shouldHideEvent from '../../shouldHideEvent';
import {wantsDateSeparator} from '../../DateUtils';
import * as sdk from '../../index';
import {_t} from "../../languageHandler";

import {MatrixClientPeg} from '../../MatrixClientPeg';
import SettingsStore from '../../settings/SettingsStore';

const CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000; // 5 minutes
const continuedTypes = ['m.sticker', 'm.room.message'];

/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */

const CaseObservationsPanel = createReactClass({
    displayName: 'CaseObservationsPanel',

    propTypes: {
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
    },

    componentWillMount: function() {
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
    },

    componentWillUnmount: function() {
        this._isMounted = false;
    },

    /* get the DOM node representing the given event */
    getNodeForEventId: function(eventId) {
        if (!this.eventNodes) {
            return undefined;
        }

        return this.eventNodes[eventId];
    },

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    getReadMarkerPosition: function() {
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
    },

    _isUnmounting: function() {
        return !this._isMounted;
    },

    _shouldShowEvent: function(mxEv) {
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
    },

    _getEventTiles: function() {

        this.eventNodes = {};

        let visible = false;
        let i;

        // we need to figure out which is the last event we show which isn't
        // a local echo, to manage the read-marker.
        let lastShownEvent;

        let lastShownNonLocalEchoIndex = -1;
        for (i = this.props.events.length-1; i >= 0; i--) {
            const mxEv = this.props.events[i];

            if (!this._shouldShowEvent(mxEv)) {
                continue;
            }

            if (lastShownEvent === undefined) {
                lastShownEvent = mxEv;
            }

            if (mxEv.status) {
                // this is a local echo
                continue;
            }

            lastShownNonLocalEchoIndex = i;
            break;
        }

        const ret = [];
        let caseSeverity = 'info';
        let caseEvents = [];
        let patientEvents = [];
        let observationEvents = [];
        let doneEvents = [];

        for (i = 0; i < this.props.events.length; i++) {
          const mxEv = this.props.events[i];

          if (mxEv.event.state_key === "care.amp.case" || mxEv.event.type === "care.amp.case" || mxEv._clearEvent.type === "care.amp.case") {
            caseEvents.push(mxEv);

            // get case severity
            if (mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined) {
                continue;
            }

            let local_event = mxEv.event;
            if (mxEv.event.type === 'm.room.encrypted') {
                local_event = mxEv._clearEvent;
            }
            caseSeverity = local_event.content.severity;
          }

          if (mxEv.event.state_key === "care.amp.patient" || mxEv.event.type === "care.amp.patient"  || mxEv._clearEvent.type === "care.amp.patient") {
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
            case('critical'):
                severityClass = "amp_CaseObservationsPanel_Severity_critical";
                break;
            case('urgent'):
                severityClass = "amp_CaseObservationsPanel_Severity_urgent";
                break;
            case('request'):
                severityClass = "amp_CaseObservationsPanel_Severity_request";
                break;
        }

        const caseStyle = ( caseEvents.length > 0 || patientEvents.length > 0 || observationEvents.length > 0 ) ? {} : { display: 'none' };

        // parse case events
        if (caseEvents.length > 0) {
            // show only once
            ret.push(this._parseCaseData(caseEvents[0]));
        }

        // parse patient events
        for (i = 0; i < patientEvents.length; i++) {
            const mxEv = patientEvents[i];
            ret.push(this._parsePatientData(mxEv));
            break; // show only once
        }

        // parse observation events
        ret.push(this._parseObservationData(observationEvents));

        // parse done events
        for (i = 0; i < doneEvents.length; i++) {
            const mxEv = doneEvents[i];
            ret.push(this._parseDone(mxEv))
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
    },

    // get a list of read receipts that should be shown next to this event
    // Receipts are objects which have a 'userId', 'roomMember' and 'ts'.
    _getReadReceiptsForEvent: function(event) {
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
    },

    _startAnimation: function(ghostNode) {
        if (this._readMarkerGhostNode) {
            Velocity.Utilities.removeData(this._readMarkerGhostNode);
        }
        this._readMarkerGhostNode = ghostNode;

        if (ghostNode) {
            Velocity(ghostNode, {opacity: '0', width: '10%'},
                     {duration: 400, easing: 'easeInSine',
                      delay: 1000});
        }
    },

    _collectEventNode: function(eventId, node) {
        this.eventNodes[eventId] = node;
    },

    _parseDone: function(mxEv) {
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

      let local_event = mxEv.event;
      if (mxEv.event.type === 'm.room.encrypted') {
          local_event = mxEv._clearEvent;
      }

      if (local_event.type === "care.amp.done") {
          return  <div className="amp_CaseObservationsPanel_isClosedWarning">
                      <hr/>
                      <span>{_t("This case has been closed. Editing is not possible anymore.")}</span>
                      <hr/>
                  </div>;
      }
    },

    _parseCaseData: function(mxEv) {

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

      let local_event = mxEv.event;
      if (mxEv.event.type === 'm.room.encrypted') {
          local_event = mxEv._clearEvent;
      }

      let caseTitle = '-';
      let caseNote = '-';
      let caseSeverity = '-';
      let caseRequester = '-';

      if (local_event.content.title !== undefined) {
          caseTitle = local_event.content.title;
      }
      if (local_event.content.note !== undefined) {
          caseNote = local_event.content.note;
      }
      if (local_event.content.severity !== undefined) {
          caseSeverity = local_event.content.severity;
      }
      if (local_event.content.requester !== undefined) {
          caseRequester = local_event.content.requester.reference;
      }

      return (
        <div className="amp_CaseObservationsPanel_CaseDetails">
            <table className="amp_CaseObservationsPanel_Table">
                <tbody>
                    <tr>
                        <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Title")}</span></td>
                        <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Severity")}</span></td>
                        <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Requester")}</span></td>
                    </tr>
                    <tr>
                        <td width="60%"><span className="amp_CaseObservationsPanel_caseData">{caseTitle}</span></td>
                        <td width="20%"><span className="amp_CaseObservationsPanel_caseData">{_t(caseSeverity)}</span></td>
                        <td width="20%"><span className="amp_CaseObservationsPanel_caseData">{caseRequester}</span></td>
                    </tr>
                </tbody>
            </table>
            <table className="amp_CaseObservationsPanel_Table">
                <tbody>
                    <tr>
                        <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Message")}</span></td>
                    </tr>
                    <tr>
                        <td><span className="amp_CaseObservationsPanel_caseData">{caseNote}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
      );
    },

    _parsePatientData: function(mxEv) {
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

        let local_event = mxEv.event;
        if (mxEv.event.type === 'm.room.encrypted') {
            local_event = mxEv._clearEvent;
        }

        let patientName = '-';
        let patientGender = '-';
        let patientBirthdate = '-';

        if (local_event.content.name !== '' && local_event.content.name !== undefined) {
            patientName = local_event.content.name;
        }
        if (local_event.content.gender !== undefined) {
            patientGender = local_event.content.gender;
        }
        if (local_event.content.birthDate !== '' && local_event.content.birthDate !== undefined) {
            var date = new Date(local_event.content.birthDate);
            patientBirthdate = date.toLocaleDateString();
        }

        return(
            <div className="amp_CaseObservationsPanel_Patient">
                    <table className="amp_CaseObservationsPanel_Table_patientData">
                        <tbody>
                            <tr>
                                <td><span className="amp_CaseObservationsPanel_patientData_header">{_t("Patient name")}</span></td>
                                <td><span className="amp_CaseObservationsPanel_patientData_header">{_t("Gender")}</span></td>
                                <td><span className="amp_CaseObservationsPanel_patientData_header">{_t("Birthday")}</span></td>
                            </tr>
                            <tr>
                                <td><span className="amp_CaseObservationsPanel_patientData">{patientName}</span></td>
                                <td><span className="amp_CaseObservationsPanel_patientData">{_t(patientGender)}</span></td>
                                <td><span className="amp_CaseObservationsPanel_patientData">{patientBirthdate}</span></td>
                            </tr>
                        </tbody>
                    </table>
              </div>
            );
      },

      _parseObservationData: function(observationEvents) {

        let hasVitalData = false;
        let hasAnamnesisData = false;

        let vitalData_bloodPressureSys: '-';
        let vitalData_bloodPressureDia: '-';
        let vitalData_bloodpressureDatetime: '-';
        let vitalData_pulse: '-';
        let vitalData_pulseDatetime: '-';
        let vitalData_temperature: '-';
        let vitalData_temperatureDatetime: '-';
        let vitalData_bloodSugar: '-';
        let vitalData_bloodSugarDatetime: '-';
        let vitalData_weight: '-';
        let vitalData_weightDatetime: '-';
        let vitalData_oxygen: '-';
        let vitalData_oxygenDatetime: '-';
        let anamnesisData_responsiveness: '-';
        let anamnesisData_pain: '-';
        let anamnesisData_lastDefecation: '-';
        let anamnesisData_misc: '-';

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

            let local_event = mxEv.event;
            if (mxEv.event.type === 'm.room.encrypted') {
                local_event = mxEv._clearEvent;
            }

            switch (local_event.content.id) {
                case('heart-rate'):
                    vitalData_pulse = local_event.content.valueQuantity.value;
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        vitalData_pulseDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalData_pulseDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case('glucose'):
                    vitalData_bloodSugar = local_event.content.valueQuantity.value;
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        vitalData_bloodSugarDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalData_bloodSugarDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case('body-temperature'):
                    vitalData_temperature = local_event.content.valueQuantity.value;
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        vitalData_temperatureDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalData_temperatureDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case('blood-pressure'):
                    vitalData_bloodPressureSys = local_event.content.component[0].valueQuantity.value;
                    vitalData_bloodPressureDia = local_event.content.component[1].valueQuantity.value;
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        vitalData_bloodpressureDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalData_bloodpressureDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case('body-weight'):
                    vitalData_weight = local_event.content.valueQuantity.value;
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        vitalData_weightDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalData_weightDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case('oxygen'):
                    vitalData_oxygen = local_event.content.valueQuantity.value;
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        vitalData_oxygenDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    } else {
                        vitalData_oxygenDatetime = '-';
                    }
                    hasVitalData = true;
                    break;
                case('last-defecation'):
                    if (local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined) {
                        var date = new Date(local_event.content.effectiveDateTime);
                        anamnesisData_lastDefecation = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                        hasAnamnesisData = true;
                    }
                    break;
                case('misc'):
                    anamnesisData_misc = local_event.content.valueString;
                    hasAnamnesisData = true;
                    break;
                case('responsiveness'):
                    anamnesisData_responsiveness = local_event.content.valueString;
                    hasAnamnesisData = true;
                    break;
                case('pain'):
                    anamnesisData_pain = local_event.content.valueString;
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
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_weight} kg</td>
                              <td>{_t("Temperature")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_temperature} °C</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_weightDatetime}</td>
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_temperatureDatetime}</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Even">
                              <td>{_t("Blood pressure")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_bloodPressureSys} mmHg / {vitalData_bloodPressureDia} mmHg</td>
                              <td>{_t("Blood sugar")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_bloodSugar} mg/dl</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Even">
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_bloodpressureDatetime}</td>
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_bloodSugarDatetime}</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("Pulse")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_pulse} bpm</td>
                              <td>{_t("Oxygen saturation")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_oxygen} %</td>
                          </tr>
                          <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_pulseDatetime}</td>
                              <td>{_t("measured")}</td>
                              <td className="amp_CaseObservationsPanel_TableCell_Value">{vitalData_oxygenDatetime}</td>
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
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisData_responsiveness}</td>
                                  <td>{_t("Pain")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisData_pain}</td>
                              </tr>
                              <tr className="amp_CaseObservationsPanel_TableRow_Even">
                                  <td>{_t("Last defecation")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisData_lastDefecation}</td>
                                  <td>{_t("Misc")}</td>
                                  <td className="amp_CaseObservationsPanel_TableCell_Value">{anamnesisData_misc}</td>
                              </tr>
                          </tbody>
                      </table>
                </div>
            </div>
          );
      },

    render: function() {

        return ( this._getEventTiles() );

    },
});

export default CaseObservationsPanel;
