/**
 * Copyright � 2001 The JA-SIG Collaborative.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in
 *    the documentation and/or other materials provided with the
 *    distribution.
 *
 * 3. Redistributions of any form whatsoever must retain the following
 *    acknowledgment:
 *    "This product includes software developed by the JA-SIG Collaborative
 *    (http://www.jasig.org/)."
 *
 * THIS SOFTWARE IS PROVIDED BY THE JA-SIG COLLABORATIVE "AS IS" AND ANY
 * EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE JA-SIG COLLABORATIVE OR
 * ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 *
 * formatted with JxBeauty (c) johann.langhofer@nextra.at
 */


package  org.jasig.portal.channels;

import  java.net.URL;
import  java.util.Hashtable;
import  java.util.HashMap;
import  javax.naming.InitialContext;
import  javax.naming.Context;
import  javax.naming.NamingException;
import  javax.naming.NotContextException;
import  org.jasig.portal.security.Permission;
import  org.jasig.portal.security.PermissionManager;
import  org.jasig.portal.ChannelRuntimeData;
import  org.jasig.portal.ICacheable;
import  org.jasig.portal.ChannelCacheKey;
import  org.jasig.portal.MediaManager;
import  org.jasig.portal.UtilitiesBean;
import  org.jasig.portal.PortalException;
import  org.jasig.portal.GeneralRenderingException;
import  org.jasig.portal.services.LogService;
import  org.jasig.portal.utils.XSLT;
import  org.jasig.portal.utils.SmartCache;
import  org.jasig.portal.utils.DocumentFactory;
import  org.xml.sax.ContentHandler;
import  org.w3c.dom.Document;
import  org.w3c.dom.Element;


/**
 * This channel provides content for a page header.  It is indended
 * to be included in a layout folder of type "header".  Most stylesheets
 * will render the content of such header channels consistently on every
 * page.
 * @author Peter Kharchenko
 * @author Ken Weiner, kweiner@interactivebusiness.com
 * @author Bernie Durfee, bdurfee@interactivebusiness.com
 * @version $Revision 1.1$
 */
public class CHeader extends BaseChannel
    implements ICacheable {
  // Cache the answers to canUserPublish() to speed things up
  private static SmartCache m_canUserPublishResponses = new SmartCache(60*10);
  private static final String sslLocation = UtilitiesBean.fixURI("webpages/stylesheets/org/jasig/portal/channels/CHeader/CHeader.ssl");

  /**
   * Render method.
   * @param out
   * @exception PortalException
   */
  public void renderXML (ContentHandler out) throws PortalException {
    // Perform the transformation
    XSLT xslt = new XSLT();
    xslt.setXML(getUserXML());
    xslt.setXSL(sslLocation, runtimeData.getBrowserInfo());
    xslt.setTarget(out);
    xslt.setStylesheetParameter("baseActionURL", runtimeData.getBaseActionURL());
    if (staticData.getPerson().isGuest()) {
      xslt.setStylesheetParameter("guest", "true");
    }
    xslt.transform();
  }

  /**
   * Returns the DOM object associated with the user
   * NOTE: This should be made more effecient through caching
   * @return
   */
  private Document getUserXML () {
    // Get the fullname of the current user
    String fullName = (String)staticData.getPerson().getFullName();
    // Get a new DOM instance
    Document doc = DocumentFactory.getNewDocument();
    // Create <header> element
    Element headerEl = doc.createElement("header");
    // Create <full-name> element under <header>
    Element fullNameEl = doc.createElement("full-name");
    fullNameEl.appendChild(doc.createTextNode(fullName));
    headerEl.appendChild(fullNameEl);
    // Create <timestamp-long> element under <header>
    Element timeStampLongEl = doc.createElement("timestamp-long");
    timeStampLongEl.appendChild(doc.createTextNode(UtilitiesBean.getDate("EEEE, MMM d, yyyy 'at' hh:mm a")));
    headerEl.appendChild(timeStampLongEl);
    // Create <timestamp-short> element under <header>
    Element timeStampShortEl = doc.createElement("timestamp-short");
    timeStampShortEl.appendChild(doc.createTextNode(UtilitiesBean.getDate("M.d.y h:mm a")));
    headerEl.appendChild(timeStampShortEl);
    // Don't render the publish, subscribe, user preferences links if it's the guest user
    if (!staticData.getPerson().isGuest()) {
      Context globalIDContext = null;
      try {
        // Get the context that holds the global IDs for this user
        globalIDContext = (Context)staticData.getPortalContext().lookup("/users/" + staticData.getPerson().getID() + "/channel-ids");
      } catch (NotContextException nce) {
        LogService.instance().log(LogService.ERROR, "CHeader.getUserXML(): Could not find subcontext " + "/users/" + staticData.getPerson().getID()
            + "/channel-ids" + " in JNDI");
      } catch (NamingException e) {
        LogService.instance().log(LogService.ERROR, e);
      }
      try {
        if (canUserPublish()) {
          // Create <chan-mgr-chanid> element under <header>
          Element chanMgrChanidEl = doc.createElement("chan-mgr-chanid");
          chanMgrChanidEl.appendChild(doc.createTextNode((String)globalIDContext.lookup("/portal/channelmanager/general")));
          headerEl.appendChild(chanMgrChanidEl);
        }
      } catch (NotContextException nce) {
        LogService.instance().log(LogService.ERROR, "CHeader.getUserXML(): Could not find channel ID for fname=/portal/channelmanager/general for UID="
            + staticData.getPerson().getID() + ". Be sure that the channel is in their layout.");
      } catch (NamingException e) {
        LogService.instance().log(LogService.ERROR, e);
      }
      try {
        // Create <preferences-chanid> element under <header>
        Element preferencesChanidEl = doc.createElement("preferences-chanid");
        preferencesChanidEl.appendChild(doc.createTextNode((String)globalIDContext.lookup("/portal/userpreferences/general")));
        headerEl.appendChild(preferencesChanidEl);
      } catch (NotContextException nce) {
        LogService.instance().log(LogService.ERROR, "CHeader.getUserXML(): Could not find channel ID for fname=/portal/userpreferences/general for UID="
            + staticData.getPerson().getID() + ". Be sure that the channel is in their layout.");
      } catch (NamingException e) {
        LogService.instance().log(LogService.ERROR, e);
      }
    }
    doc.appendChild(headerEl);
    return  (doc);
  }

  /**
   * Checks user permissions to see if the user is authorized to publish channels
   * @return
   */
  private boolean canUserPublish () {
    // Get the current user ID
    int userID = staticData.getPerson().getID();
    // Check the cache for the answer
    if (m_canUserPublishResponses.get("USER_ID." + userID) != null) {
      // Return the answer if it's in the cache
      if (((Boolean)m_canUserPublishResponses.get("USER_ID." + userID)).booleanValue()) {
        return  (true);
      } 
      else {
        return  (false);
      }
    }
    // Get a reference to the PermissionManager for this channel
    PermissionManager pm = staticData.getPermissionManager();
    try {
      // Check to see if the user or all user's are specifically denied access
      if (pm.getPermissions("USER_ID." + userID, "PUBLISH", "*", "DENY").length > 0 || pm.getPermissions("*", "PUBLISH", 
          "*", "DENY").length > 0) {
        // Cache the result
        m_canUserPublishResponses.put("USER_ID." + userID, new Boolean(false));
        return  (false);
      }
      // Check to see if the user or all users are granted permission by default
      if (pm.getPermissions("USER_ID." + userID, "PUBLISH", "*", "GRANT").length > 0 || pm.getPermissions("*", "PUBLISH", 
          "*", "GRANT").length > 0) {
        // Cache the result
        m_canUserPublishResponses.put("USER_ID." + userID, new Boolean(true));
        return  (true);
      }
      // Since no permission exist for this user we will return true by default
      return  (true);
    } catch (Exception e) {
      LogService.instance().log(LogService.ERROR, e);
      // Deny the user publish access if anything went wrong
      return  (false);
    }
  }

  /**
   * put your documentation comment here
   * @return 
   */
  public ChannelCacheKey generateKey () {
    ChannelCacheKey k = new ChannelCacheKey();
    StringBuffer sbKey = new StringBuffer(1024);
    // guest pages are cached system-wide
    k.setKeyScope(ChannelCacheKey.SYSTEM_KEY_SCOPE);
    sbKey.append("userId:").append(staticData.getPerson().getID()).append(", ");
    sbKey.append("baseActionURL:").append(runtimeData.getBaseActionURL());
    sbKey.append("stylesheetURI:");
    try {
      sbKey.append(XSLT.getStylesheetURI(sslLocation, runtimeData.getBrowserInfo()));
    } catch (Exception e) {
      sbKey.append("not defined");
    }
    k.setKey(sbKey.toString());
    k.setKeyValidity(new Long(System.currentTimeMillis()));
    return  k;
  }

  /**
   * put your documentation comment here
   * @param validity
   * @return 
   */
  public boolean isCacheValid (Object validity) {
    if (validity instanceof Long) {
      Long oldtime = (Long)validity;
      if (staticData.getPerson().isGuest()) {
        return  true;
      }
      if (System.currentTimeMillis() - oldtime.longValue() < 1*60*1000) {
        return  true;
      }
    }
    return  false;
  }
}



