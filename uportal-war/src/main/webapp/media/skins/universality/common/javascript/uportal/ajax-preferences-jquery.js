/*
 * Licensed to Jasig under one or more contributor license
 * agreements. See the NOTICE file distributed with this work
 * for additional information regarding copyright ownership.
 * Jasig licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
	CONFIGURATION PARAMETERS
	

*/
(function($){
	
    // if the uPortal scope is not available, add it
    $.uportal = $.uportal || {};
    
    $.uportal.UportalLayoutManager = function(callerSettings) {
		var settings = $.extend({
		    preferencesUrl: 'mvc/layout',
		    channelListUrl: 'mvc/channelList?xml=true',
            subscriptionListUrl: 'mvc/tabList',
		    portalUrl: null,
		    mediaPath: null,
		    currentSkin: null,
		    isFocusMode: false,
		    isFragmentMode: false,
		    messages: {}
	    }, callerSettings||{});


		/*
			INTERNAL METHODS
		*/

		// Initialization tasks for non-focused mode
		var initportal = function() {

		    settings.columnCount = $("#portalPageBodyColumns [id^=column_]").size(); 
		    if ($("#portalNavigationList li.active").size() > 0) {
			    settings.tabId = $("#portalNavigationList li.active").attr("id").split("_")[1];
		    }
		
			// initialize dialog menus
			$("#contentDialogLink").click(initializeContentAddingMenu);
			$("#skinDialogLink").click(initializeSkinMenu);
		
			// set up the Fluid reorderer to control portlet drag and drop
		    var options = {
		         selectors: {
			        columns: ".portal-page-column-inner",
			        modules: ".up-portlet-wrapper",
			        lockedModules: ".locked",
			        dropWarning: $("#portalDropWarning"),
			        grabHandle: "[id*=toolbar_]"
		         },
		         listeners: {
		         	afterMove: movePortlet
		         },
		         styles: {
		         	mouseDrag: "fl-reorderer-movable-dragging-mouse"
		         }
		    };
		    settings.myReorderer = up.fluid.reorderLayout ("#portalPageBodyColumns",options);

		    
		    $("#pageLayoutDialog").dialog({ width: 550, modal: true, autoOpen: false });
		    
		    $(".edit-page-link").click(function(){
		        $("#pageLayoutDialog").dialog("open");
		    });
            
          uportal.PageManager("#pageLayoutDialog", {
              currentPageName: $("#tabLink_" + settings.tabId + " > span").text(),
              isDefault: true,
              currentLayout: getCurrentLayout(),
              savePermissionsUrl: settings.preferencesUrl,
              imagePath: settings.mediaPath + "/" + settings.currentSkin + "/images/",
              selectors: {
              },
              listeners: {
                  onUpdateLayout: changeColumns,
                  onUpdatePageName: updatePageName,
                  onUpdateIsDefault: null
              }
          });

		    if (settings.isFragmentMode) {
                // tabs permissions manager
                uportal.LayoutManager("body", {
                    savePermissionsUrl: settings.preferencesUrl,
                    elementExtractor: function(that, link){
                        return $(link).parents(".portal-flyout-container"); 
                    },
                    titleExtractor: function(element){ return "tab"; },
                    selectors: {
                        permissionsLink: "#editPagePermissionsLink a",
                        permissionsDialog: ".edit-page-permissions-dialog",
                        formTitle: ".edit-page-permissions-dialog h2"
                    }
                });
    
                // columns permissions manager
                uportal.LayoutManager("body", {
                    savePermissionsUrl: settings.preferencesUrl,
                    elementExtractor: function(that, link){
                        return $(link).parents(".portal-page-column"); 
                    },
                    titleExtractor: function(element){ 
                        return "Column " + ($(".portal-page-column").index(element) + 1); 
                    },
                    selectors: {
                        permissionsLink: "#pageDialogLink",
                        permissionsDialog: ".edit-column-permissions-dialog",
                        formTitle: ".edit-column-permissions-dialog h2"
                    }
                });
    
                // portlet permissions manager
                uportal.LayoutManager("body", {
                    savePermissionsUrl: settings.preferencesUrl,
                    elementExtractor: function(that, link){
                        return $(link).parents(".up-portlet-wrapper"); 
                    },
                    titleExtractor: function(element){ return element.find(".up-portlet-wrapper-inner h2 a").text(); },
                    selectors: {
                        permissionsLink: ".portlet-permissions-link",
                        permissionsDialog: ".edit-portlet-permissions-dialog",
                        formTitle: ".edit-portlet-permissions-dialog h2"
                    },
                    listeners: {
                        onUpdatePermissions: function(element, newPermissions) {
                            if (!newPermissions.movable) {
                                element.addClass("locked").removeClass("fl-reorderer-movable-default");
                                element.find("[id*=toolbar_]").removeClass("ui-draggable");
                            } else {
                                element.removeClass("locked").addClass("fl-reorderer-movable-default");
                                element.find("[id*=toolbar_]").addClass("ui-draggable");
                            }
                            settings.myReorderer.refresh();
                        }
                    }
                });
		    }


		    // add onclick events for portlet delete buttons
			$('a[id*=removePortlet_]').each(function(i){$(this).click(function(){deletePortlet(this.id.split("_")[1]);return false;});});	
		
			// set click handlers for tab moving and editing links
            $("#addTabLink").click(initializeSubscribeTabMenu);
			$("#deletePageLink").click(function(){deleteTab()});
			$("#movePageLeftLink").click(function(){moveTab('left')});
			$("#movePageRightLink").click(function(){moveTab('right')});
			initTabEditLinks();
		
		};
		
		var chooseCategory = function(categoryId) {
			var select = $("#channelSelectMenu").html("");
			var channels = settings.channelBrowser.getChannelsForCategory(categoryId);
			$(channels).each(function(i, val) {
				select.get(0).options[i] = new Option(this.name, this.id);
			});

			select
				.change(function(){ chooseChannel(this.value); })
				.children("option:first").attr("selected", true);
			chooseChannel(select.val());
			
		};

		var chooseChannel = function(chanId) {
			var channel = settings.channelBrowser.getChannel(chanId);
			$("#channelTitle").text(channel.name);
			$("#channelDescription").text(channel.description);
			$("#addChannelId").attr("value", channel.id);
			$("#previewChannelLink").unbind("click").click(function(){ 
				window.location = "/uPortal/p/" + channel.fname;
			});
		};

		var searchChannels = function(searchTerm) {
			var results = $("#addChannelSearchResults").html("");
			var channels = settings.channelBrowser.searchChannels(searchTerm);
			$(channels).each(function(i){
				results.append(
					$(document.createElement('li')).append(
						$(document.createElement('a'))
							.attr("id", this.id).attr("href", "javascript:;")
							.click(function(){ chooseChannel(this.id); })
							.text(this.name)
					)
				 );
			});
			
		};

		// Initialization tasks for focus mode
		var initfocusedportal = function() {
			$("#focusedContentDialogLink").click(initializeFocusedContentMenu);
		};
		
		var initializeContentAddingMenu = function() {
            $("#channelAddingTabs").tabs();
			$("#contentAddingDialog").dialog({ width:550, modal:true});
			$("#contentDialogLink")
				.unbind('click', initializeContentAddingMenu)
				.click(function(){$("#contentAddingDialog").dialog('open');});
			settings.channelBrowser = $.channelbrowser({
		        channelXmlUrl: settings.channelListUrl,
				onDataLoad: function(categories) {
					var categorySelect = $("#categorySelectMenu");
					$(categories).each(function(i, val) {
						categorySelect.get(0).options[i] = new Option(this.name, this.id);
					});
					categorySelect.change(function(){chooseCategory(this.value)})
						.children("option:first").attr("selected", true);
					$("#addChannelSearchTerm").keyup(function(){
						searchChannels($(this).val());
					});
					chooseCategory(categorySelect.val());
			   		$("#channelLoading").css("display", "none");
			   		$("#categorySelectMenu").css("background-image", "none");
			   		$("#channelSelectMenu").css("background-image", "none");
				}
			});
			$("#addChannelLink").click(function(){addPortlet()});
		};
		
		var initializeFocusedContentMenu = function() {
			$("#focusedContentAddingDialog").dialog({ width:500, modal:true});
			$("#focusedContentDialogLink")
				.unbind('click', initializeFocusedContentMenu)
				.click(function(){$("#focusedContentAddingDialog").dialog('open');});
		    $("#focusedContentAddingDialog form").submit(function(){return addFocusedChannel(this);});
		};
		
		var getCurrentLayout = function() {
            var layouts = [];
            $('#portalPageBodyColumns > [id^=column_]').each(function(){
                var flClass = $(this).get(0).className.match("fl-col-flex[0-9]+");
                if (flClass != null) {
                    layouts.push(Number(flClass[0].match("[0-9]+")[0]));
                }
            });
            if (layouts.length == 0) layouts.push(100);
            return layouts;
		};
		var updatePage = function(form) {
			var name = form.pageName.value;
			var layout = $(form.layoutChoice).filter(":checked").val();
			var columns = layout.split("-");
			if (name != $("#portalPageBodyTitle").text())
				updatePageName(name);
			if (layout != getCurrentLayoutString())
				changeColumns(columns);
			$("#pageLayoutDialog").dialog('close');
			return false;
		};
		var updatePageName = function(name) {
			$("#tabLink_" + settings.tabId + " > span").text(name);
			$("#portalPageBodyTitle").text(name);
			updateLayout({action: 'renameTab', tabId: settings.tabId, tabName: name});
			return false;
		};
		// Column editing persistence functions
		var changeColumns = function(newcolumns) {
		    settings.columnCount = newcolumns.length;
			updateLayout({action: 'changeColumns', tabId: settings.tabId, columns: newcolumns}, 
				function(data) { 
				    var columns = $('#portalPageBodyColumns > [id^=column_]');
				    if (columns.length < newcolumns.length) {
				    	$(data.newColumnIds).each(function(){
				    	    var id = this;
				    		$("#portalPageBodyColumns")
				    			.append(
				    				$(document.createElement('div')).attr("id", 'column_' + id)
				    					.addClass("portal-page-column")
				    					.append(
				    						$(document.createElement('div'))
				    							.attr("id", 'inner-column_' + id)
				    							.addClass("portal-page-column-inner")
										)
				    			);
				    	});
				    	
				    } else if(columns.length > newcolumns.length) {
				    	for (var i = newcolumns.length; i < columns.length; i++) {
				    		var lastColumn = $("#inner-column_" + $(columns[newcolumns.length-1]).attr("id").split("_")[1]);
				    		var portlets = $(columns[i]).find("div[id*=portlet_]")
					    		.each(function(){
					    			$(this).appendTo(lastColumn);
					    		})
				    			.end().remove();
				    	}
		
				    }
				    
				    $("#portalPageBodyTitleRow").attr("colspan", newcolumns.length);
				    $('#portalPageBodyColumns > [id^=column_]').each(function(i){
				    	$(this).removeClass().addClass("portal-page-column fl-col-flex"+newcolumns[i]);
				    	if (newcolumns.length == 1) $(this).addClass("single");
				    	else if (i == 0) $(this).addClass("left");
				    	else if (i == newcolumns.length - 1) $(this).addClass("right");
				    });
				    
			    	settings.myReorderer.refresh();
			    	
			    	// remove the checked and default checked attributes from all radio
			    	// buttons and re-apply them to the current value to compensate
			    	// for IE radio button bug
			    	$("#pageLayoutDialog .changeColumns").find("input").removeAttr("checked").removeAttr("defaultChecked");
			    	$("#pageLayoutDialog .changeColumns").find("input[value=" + newcolumns.join("-") + "]").attr("checked", "checked").attr("defaultChecked","defaultChecked");
					
				}
			);
		};
		
		// Portlet editing persistence functions
		var addPortlet = function(chanId) {
		    var options = { action: 'addPortlet', channelID: $("#addChannelId").attr("value") };
		    var firstChannel = $("div[id*=portlet_]:not(.locked)");
		    if (firstChannel.size() == 0) {
		        options['elementID'] = settings.tabId;
		    } else {
		        options['elementID'] = firstChannel.attr("id").split("_")[1];
		        options['position'] = 'insertBefore';
		    }
			updateLayout(options,
			   function(data) {
			      window.location = settings.portalUrl; 
			   }
			);
		};
		var deletePortlet = function(id) {
			if (!confirm(settings.messages.confirmRemovePortlet)) return false;
			$('#portlet_'+id).remove();
			updateLayout({action: 'removeElement', elementID: id});
		};
		
		
		// Tab editing persistence functions
		var addTab = function(name, columns) {
			updateLayout({action: 'addTab', tabName: name, columns: columns}, 
			    function(data) {
			        window.location = settings.portalUrl + "?uP_root=root&uP_sparam=activeTab&activeTab=" + ($("#portalNavigationList > li").length + 1);
			    }
			);
		};
		var deleteTab = function() {
			if (!confirm(settings.messages.confirmRemoveTab)) return false;
			updateLayout({action: 'removeElement', elementID: settings.tabId}, 
			    function(xml) {
			        window.location = settings.portalUrl + "?uP_root=root&uP_sparam=activeTab&activeTab=1"; 
    			}
    		);
		};
		var moveTab = function(direction) {
			var tab = $("#portalNavigation_" + settings.tabId);
			var method = 'insertBefore';
			var targetId = null;
			var tabPosition = 1;
		
			// move the tab node
			if (direction == 'left') tab.insertBefore(tab.prev());
			else tab.insertAfter(tab.next());
			
			// get the target node and method parameters
			if (tab.is(":last-child")) {
				method = 'appendAfter';
				targetId = tab.prev().attr("id").split("_")[1];
			} else
				targetId = tab.next().attr("id").split("_")[1];
		
			// figure out what the current tab's number is
			$("[id*=portalNavigation_]").each(function(i){
				if ($(this).attr("id") == tab.attr("id"))
					tabPosition = i+1;
			});
			
			updateLayout({
				action: 'moveTab',
				sourceID: settings.tabId,
				method: method,
				elementID: targetId,
				tabPosition: tabPosition
			});
			redoTabs(settings.tabId);
			initTabEditLinks();
		};
		var initTabEditLinks = function() {
			var tab = $("#portalNavigation_" + settings.tabId);
			if (tab.not(":first-child") && tab.prev().hasClass("movable-tab"))
				$("#movePageLeftLink").css("display", "block");
			else 
				$("#movePageLeftLink").css("display", "none");
				
			if (tab.is(":last-child")) 
				$("#movePageRightLink").css("display", "none");
			else
				$("#movePageRightLink").css("display", "block");
				
			var links = $("#portalNavigationList .portal-navigation");
			links.each(function(i){
				if (links.length == 1) $(this).removeClass("first").removeClass("last").addClass("single");
				else if (i == 0) $(this).removeClass("single").removeClass("last").addClass("first");
				else if (i == links.length-1) $(this).removeClass("single").removeClass("first").addClass("last");
				else $(this).removeClass("single").removeClass("last").removeClass("first");
			});
				
			links = $("#portalFlyoutNavigationInner_" + settings.tabId).find(".portal-subnav").not("[display=none]");
			links.each(function(i){
				if (links.length == 1) $(this).removeClass("first").removeClass("last").addClass("single");
				else if (i == 0) $(this).removeClass("single").removeClass("last").addClass("first");
				else if (i == links.length-1) $(this).removeClass("single").removeClass("first").addClass("last");
				else $(this).removeClass("single").removeClass("last").removeClass("first");
			});
		};
		var redoTabs = function(tabId) {
			$("[id*=tabLink_]").each(function(i){
				$(this).attr("href", settings.portalUrl + "?uP_root=root&uP_sparam=activeTab&activeTab=" + (i+1));
			});
		//	fly.closeSubnav(tabId);
		};
		var movePortlet = function(movedNode) {
		   var method = 'insertBefore';
		   var target = null;
		   if ($(movedNode).nextAll('div[id*=portlet_]').size() > 0) {
		       target = $(movedNode).nextAll('div[id*=portlet_]').get(0);
		   } else if ($(movedNode).prevAll('div[id*=portlet_]').size() > 0) {
		       target = $(movedNode).prevAll('div[id*=portlet_]').get(0);
		       method = 'appendAfter';
		   } else {
		       target = $(movedNode).parent();
		   }
		   var columns = $('#portalPageBodyColumns > [id^=column_]');
		   updateLayout({ action: 'movePortlet', method: method, elementID: $(target).attr('id').split('_')[1], sourceID: $(movedNode).attr('id').split('_')[1]});
		};
		
		var addFocusedChannel = function(form) {
		
		    var channelId = form.channelId.value;
		    var tabPosition, elementId;
		    
		    $("#focusedContentAddingDialog input[name=targetTab]").each(function(i){
		    	if ($(this).is(":checked")) {
		    		tabPosition = i+1;
		    		elementId = $(this).val();
		    	}
		    });
		    
		    updateLayout(
		        {
		    		action: 'addPortlet',
		    		channelID: channelId,
		    		position: 'insertBefore',
		    		elementID: elementId
		    	},
		    	function(xml) {
					window.location = settings.portalUrl + "?uP_root=root&uP_sparam=activeTab&activeTab=" + tabPosition;
		    	}
		    );
			return false;
		
		};
		
		var initializeSkinMenu = function() {
			$("#skinChoosingDialog").dialog({height:450, width:500, modal:true});
			$("#skinDialogLink")
				.unbind('click', initializeSkinMenu)
				.click(function(){$("#skinChoosingDialog").dialog('open');});
		
		    var skinMenu = $("#skinList").html("").css("padding", "10px");
		    $("#skinChoosingDialog form").submit(function(){return chooseSkin(this);});
		    $.get(settings.mediaPath + '/skinList.xml?noCache=' + new Date().getTime(), { },
		    	function(xml){
					settings.skinXml = xml;
					$("skin", settings.skinXml).each(function(i){
						var key = $(this).children("skin-key").text();
						
						var input
						if ($.browser.msie) {
						    if (key == settings.currentSkin) {
		    				    input = $(document.createElement("<input type=\"radio\" name=\"skinChoice\" value=\"" + key + "\" checked=\"true\"/>"));
		    				} else {
		                        input = $(document.createElement("<input type=\"radio\" name=\"skinChoice\" value=\"" + key + "\"/>"));    				
		    				}
						} else {
		                    input = $(document.createElement("input")).attr("type", "radio")
		                        .attr("name", "skinChoice").val(key);
			                if (key == settings.currentSkin)
			                    input.attr("checked", true);
						}
						var widget = $(document.createElement("div"))
							.addClass("fl-widget");
						widget.append($(document.createElement("div"))
								.addClass("fl-widget-titlebar")
								.append(input)
								.append($(document.createElement("h2")).text($(this).children("skin-name").text()))
							);
						widget.append($(document.createElement("div"))
								.addClass("fl-widget-content")
								.append($(document.createElement("p")).text($(this).children("skin-description").text()))
								.append($(document.createElement("img")).attr("src", settings.mediaPath + "/" + key + "/" + "thumb.gif"))
							);
						skinMenu.append(widget);
					});
		
		            skinMenu.css("height", "300px").css("overflow", "auto");
		            
		        	// remove the loading graphics and message
		        	$("#skinLoading").css("display", "none");
		            $("#skinChoosingDialog").parent().parent().css("height", $("#skinChoosingDialog").parent().height() + 20);
		    	}
		    );
		};
		
		var chooseSkin = function(form) {
		    var newskin = $("#skinList").find("input:checked").val();
		    if (newskin == undefined || newskin == '')
		        return false;
			updateLayout({ action: 'chooseSkin', skinName: newskin },
				function(data) {
					window.location = settings.portalUrl;
				}
			);
			return false;
		};
		
        var initializeSubscribeTabMenu = function() {
            $("#subscribeTabTabs").tabs();
            if (settings.subscriptionsSupported == 'true') {
                uportal.FragmentBrowser($("#subscribeTab-tab-1"), 
                    {
                        fragmentServiceUrl: settings.subscriptionListUrl,
                        listeners: { 
                            onFragmentSelect: function(fragment) {
                                var tab = $("#portalNavigation_" + settings.tabId);
                                var tabPosition = 1;
                                var targetId = null;
                                // figure out what the current tab's number is
                                $("[id*=portalNavigation_]").each(function(i){
                                    if ($(this).attr("id") == tab.attr("id"))tabPosition = i+1;
                                    targetId = $(this).attr("id").split("_")[1];
                                });
            
                                var subscribeToTabVal = $("#subscribeTabId").val();
                                updateLayout({action: "subscribeToTab" ,sourceID: fragment.ownerID,method: 'appendAfter', tabPosition: tabPosition, elementID: targetId  }, function(xml) {
                                    window.location = settings.portalUrl + "?uP_root=root&uP_sparam=activeTab&activeTab=" + 
                                            ($("#portalNavigationList > li").length + 1);
                                });
                            }
                        }
                    }
                );
                $("#subscribeTabLoading").css("display", "none");
            } else {
                if ($("#subscribeTabTabs").tabs('length') > 1) $("#subscribeTabTabs").tabs('remove',0);
            }
        
            // using defaultChecked attribute to compensate for IE radio button bug
            $("#subscribeTabDialog").dialog({ width:500, modal:true });
            uportal.PageManager("#subscribeTab-tab-2", {
                currentPageName: "My Page",
                isDefault: false,
                currentLayout: [ 50, 50 ],
                savePermissionsUrl: settings.preferencesUrl,
                imagePath: settings.mediaPath + "/" + settings.currentSkin + "/images/",
                selectors: {
                },
                listeners: {
                    onSaveOptions: function(data){
                        addTab(data.pageName, data.layout);
                    }
                }
            });

            $("#addTabLink")
                .unbind("click")
                .click(function(){
                    $("#subscribeTabDialog").dialog('open');
                 });
                
        };
        
        var updateLayout = function(data, success) {
            $.ajax({
                url: settings.preferencesUrl,
                type: "POST",
                data: data,
                dataType: "json",
                success: success,
                error: function(request, text, error) {
                    if (console) {
                        console.log(request, text, error);
                    }
                }
            });
        };
        
        var handleServerError = function(xml) {
		    alert($("message", xml).text());
		};

		// initialize our portal code
		if (settings.isFocusMode) initfocusedportal(); else initportal();

	};

})(jQuery);
