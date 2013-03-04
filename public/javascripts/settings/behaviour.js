define(['jquery', 'helper'], function($, helper) {
    return {
        apply: function() {
            helper.addFormHandler('.change-password-form', '/settings/changePassword', { idAttr: 'data-user-id' });
            helper.addFormHandler('.add-user-form', '/settings/addUser', { replaceQuery: '.user-list' });
            helper.addFormHandler('.add-category-form', '/settings/addCategory', { replaceQuery: '.category-list' });


            helper.addTextFieldListener('.userlist-password', 'data-user-id', '/settings/changePassword', 'passowrd', function(data) {
                data.passwordRepeat = data.password;
                return data;
            });
            helper.addTextFieldListener('.categorylist-name', 'data-category-id', '/settings/changeCategory', 'name');
            helper.addTextFieldListener('.categorylist-destination', 'data-category-id', '/settings/changeCategory', 'destination');
            helper.addClickListener('.categorylist-delete', '/settings/delCategory', { idAttr: 'data-category-id', replaceQuery: '.category-list' });

            helper.addClickListener('.userlist-delete', '/settings/delUser', { idAttr: 'data-user-id', replaceQuery: '.user-list' });
            helper.addClickListener('.userlist-isAdmin', '/settings/setAdmin', {
                idAttr: 'data-user-id',
                dataProcessor: function(data, el) {
                    data.isAdmin = $(el).is(':checked');
                    return data;
                }
            });

        }
    };
});
