/**
 * Licensed to Apereo under one or more contributor license
 * agreements. See the NOTICE file distributed with this work
 * for additional information regarding copyright ownership.
 * Apereo licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License.  You may obtain a
 * copy of the License at the following location:
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package org.apereo.portal.api.groups;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import org.apache.commons.lang.StringUtils;
import org.apereo.portal.EntityIdentifier;
import org.apereo.portal.groups.IEntityGroup;
import org.apereo.portal.groups.IGroupMember;
import org.apereo.portal.portlets.groupselector.EntityEnum;
import org.apereo.portal.security.IPerson;
import org.apereo.portal.services.GroupService;
import org.springframework.stereotype.Service;

@Service
public class ApiGroupsService implements GroupsService {
    private static final String ROOT_GROUP_KEY = "local.0";

    @Override
    public Entity getRootGroup() {
        IEntityGroup entityGroup = GroupService.findGroup(ROOT_GROUP_KEY);
        return EntityFactory.createEntity(entityGroup,EntityEnum.GROUP);
    }

    @Override
    public Entity getGroup(String groupId,boolean populateChildren) {
        return EntityService.instance().getEntity(EntityEnum.GROUP.toString(),groupId,populateChildren);
    }

    @Override
    public Entity findGroup(String groupName,boolean populateChildren) {
        Set<Entity> groups = findGroups(groupName);
        if((groups !=  null) && (groups.size() > 0)) {
            Entity entity = null;
            for(Iterator<Entity> it = groups.iterator(); it.hasNext(); ) {
                entity = it.next();
                if(entity.getName().equalsIgnoreCase(groupName)) {
                    return entity;
                }
            }
        }
        return null;
    }

    @Override
    public Set<Entity> findGroups(String searchTerm) {
        return EntityService.instance().search(Entity.ENTITY_GROUP,searchTerm);
    }

    @Override
    public Set<Entity> getGroupsForMember(String memberName) {
        Set<Entity> groups = new HashSet<Entity>();
        if(StringUtils.isNotEmpty(memberName)) {
            EntityIdentifier[] identifiers = GroupService.searchForEntities(memberName, GroupService.IS,EntityEnum.PERSON.getClazz());
            for(EntityIdentifier entityIdentifier : identifiers) {
                if(entityIdentifier.getType().equals(EntityEnum.PERSON.getClazz())) {
                    IGroupMember groupMember = GroupService.getGroupMember(entityIdentifier);
                    if(memberName.equalsIgnoreCase(groupMember.getKey())) {
                        Iterator it = GroupService.findParentGroups(groupMember);
                        while(it.hasNext()) {
                            IEntityGroup g = (IEntityGroup)it.next();
                            Entity e = EntityFactory.createEntity(g,EntityEnum.getEntityEnum(g.getLeafType(),true));
                            groups.add(e);
                        }
                        return groups;
                    }
                }
            }
        }
        return groups;
    }

    @Override
    public Entity findMember(String memberName,boolean populateChildren) {
        Set<Entity> members = findMembers(memberName);
        if(members != null) {
            for(Entity entity :members) {
                if(entity.getId().equalsIgnoreCase(memberName)) {
                    return entity;
                }
            }
        }
        return null;
    }

    @Override
    public Set<Entity> findMembers(String searchTerm) {
        return EntityService.instance().search(Entity.ENTITY_PERSON,searchTerm);
    }

    @Override
    public Set<Entity> getMembersForGroup(String groupName) {
        Set<Entity> members = new HashSet<Entity>();
        if(StringUtils.isNotEmpty(groupName)) {
            EntityIdentifier[] identifiers = GroupService.searchForGroups(groupName,GroupService.IS,EntityEnum.GROUP.getClazz());
            for(EntityIdentifier entityIdentifier : identifiers) {
                if(entityIdentifier.getType().equals(IEntityGroup.class)) {
                    IGroupMember groupMember = GroupService.getGroupMember(entityIdentifier);
                    if(groupMember.getLeafType().equals(IPerson.class)) {
                        String groupMemberName = EntityService.instance().lookupEntityName(EntityEnum.GROUP,groupMember.getKey());
                        if(groupName.equalsIgnoreCase(groupMemberName)) {
                            for (IGroupMember gm : groupMember.asGroup().getDescendants()) {
                                if (!gm.isGroup()) {
                                    EntityIdentifier ident = gm.getUnderlyingEntityIdentifier();
                                    Entity member = findMember(ident.getKey(), true);
                                    members.add(member);
                                }
                            }
                            return members;
                        }
                    }
                }
            }
        }
        return members;
    }
}
