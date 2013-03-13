define(['jquery', 'helper'], function($, helper) {
    return {
        apply: function() {
            helper.addFormHandler('.change-password-form', '/settings/changePassword');
            helper.addFormHandler('.add-user-form', '/settings/addUser', { replaceQuery: '.user-list' });
            helper.addFormHandler('.add-category-form', '/settings/addCategory', { replaceQuery: '.category-list' });


            helper.addTextFieldListener('.userlist-password', '/settings/changePassword', 'password', function(data) {
                data.passwordRepeat = data.password;
                return data;
            });
            helper.addTextFieldListener('.categorylist-name', '/settings/changeCategory', 'name');
            helper.addTextFieldListener('.categorylist-destination', '/settings/changeCategory', 'destination');
            helper.addClickListener('.categorylist-delete', '/settings/delCategory', { replaceQuery: '.category-list' });

            helper.addClickListener('.userlist-delete', '/settings/delUser', { replaceQuery: '.user-list' });
            helper.addClickListener('.userlist-isAdmin', '/settings/setAdmin', {
                dataProcessor: function(data, el) {
                    data.isAdmin = $(el).is(':checked');
                    return data;
                }
            });

        }
    };
});
