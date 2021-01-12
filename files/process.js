module.exports = async function (req, res, db, http_page, firebase, custom_modules, _) {

    try {

        // Default Patreon Account
        if (typeof req.query.account === "string") {

            // Validator
            if (req.query.account.length > 0) {

                // Prepare Patreon Module
                let patreonManager = null;

                // Prepare Body
                if (!req.body) {
                    req.body = '{}';
                }

                // Convert
                if (typeof req.body !== "string") {
                    req.body = req.rawBody;
                }

                // Get Settings
                let patreon_settings = await firebase.getDBAsync(db.child('settings').child(firebase.databaseEscape(req.query.account)));
                patreon_settings = firebase.getDBValue(patreon_settings);

                // Verify Data
                let success = false;

                // Verify Patreon
                if (patreon_settings && typeof patreon_settings.webhookSecret === "string") {
                    patreonManager = require('./data_control');
                    success = patreonManager.verify(req, patreon_settings.webhookSecret);
                }

                // Success Verify
                if (success) {

                    // Event Validator
                    const last_event_item = req.header('x-patreon-event');
                    if (
                        typeof last_event_item === "string" && (
                            last_event_item === "members:create" ||
                            last_event_item === "members:update" ||
                            last_event_item === "members:delete" ||
                            last_event_item === "members:pledge:create" ||
                            last_event_item === "members:pledge:update" ||
                            last_event_item === "members:pledge:delete"
                        )
                    ) {

                        // Custom Module Config
                        if (!Array.isArray(custom_modules)) {
                            custom_modules = [];
                        }

                        // Prepare User Data
                        db = db.child(firebase.databaseEscape(req.query.account));

                        // Prepare Body
                        req.body = JSON.parse(req.body);
                        const finalData = await patreonManager.get(req.body);

                        // Exist Data
                        if (finalData && typeof finalData.patron_id === "string" && finalData.patron_id !== "") {

                            // Prepare Moment
                            const moment = require('moment-timezone');

                            // Get Patreon Data DB
                            let patreon_data = db.child('main').child(firebase.databaseEscape(finalData.patron_id));

                            // Get Last Data
                            let last_data = await firebase.getDBAsync(patreon_data);
                            last_data = firebase.getDBValue(last_data);

                            // Timers
                            const now_time = moment.utc();
                            const timers = { now: now_time.valueOf() };

                            // Exist Last
                            if (last_data && typeof last_data.last_verify === "string" && last_data.last_verify.length > 0) {
                                timers.last = last_data.last_verify;
                            }

                            // Check Time
                            if (!timers.last || timers.now >= timers.last) {

                                // Prepare Insert Data
                                const insert_data = {

                                    pledge_amount: Number(finalData.pledge_amount) / 100,
                                    currently_amount: Number(finalData.currently_amount) / 100,
                                    will_pay_amount: Number(finalData.will_pay_amount) / 100,
                                    patreon_id: finalData.patron_id,

                                    last_verify: {
                                        iso: now_time.toISOString(),
                                        value: now_time.valueOf()
                                    },

                                    last_event: last_event_item
                                };

                                // Fix Numbers
                                if (isNaN(insert_data.pledge_amount)) {
                                    insert_data.pledge_amount = 0;
                                }

                                if (isNaN(insert_data.currently_amount)) {
                                    insert_data.currently_amount = 0;
                                }

                                if (isNaN(insert_data.will_pay_amount)) {
                                    insert_data.will_pay_amount = 0;
                                }

                                // Prepare Level
                                if (patreon_settings.levels) {

                                    // Main Value
                                    insert_data.patreon_level = 0;

                                    // Convert to Key Array
                                    let levelKeys = Object.keys(patreon_settings.levels);
                                    levelKeys.sort(function (a, b) { return Number(b) - Number(a) });

                                    // Order
                                    for (const item in levelKeys) {
                                        if (insert_data.pledge_amount >= patreon_settings.levels[levelKeys[item]]) {
                                            insert_data.patreon_level = patreon_settings.levels[levelKeys[item]];
                                        }
                                    }

                                }

                                // Is Insert
                                const isInsert = (
                                    insert_data.last_event !== "members:delete" &&
                                    insert_data.last_event !== "members:pledge:delete" && (
                                        insert_data.pledge_amount > 0 || insert_data.currently_amount > 0 || insert_data.will_pay_amount > 0
                                    )
                                );

                                // Prepare Data
                                let campaign_data = db.child('patreon_campaign');

                                // Social List
                                const social_list = {
                                    data: {},
                                    db: {}
                                };

                                // Build Extra Data
                                const build_extra_data = async function (options) {

                                    // Prepare User Data
                                    let user_data = null;

                                    // Set User data
                                    if (!options.var_name) {

                                        // Fix Var Name
                                        options.var_name = options.database;

                                        // The User Data
                                        if (finalData[options.var_name] && (typeof finalData[options.var_name].id === "string" || typeof finalData[options.var_name].id === "number")) {
                                            user_data = db.child(options.database).child(firebase.databaseEscape(finalData[options.var_name].id));
                                        }

                                    } else {

                                        // The User Data
                                        if (typeof finalData[options.var_name] === "string" || typeof finalData[options.var_name] === "number") {
                                            user_data = db.child(options.database).child(firebase.databaseEscape(finalData[options.var_name]));
                                        }

                                    }

                                    // Exist Item
                                    if (user_data) {

                                        // Database Data
                                        if (typeof finalData[options.var_name] !== "undefined") {

                                            // Insert Database Data
                                            if (isInsert) {

                                                // Prepare Database Item
                                                social_list.data[options.var_name] = finalData[options.var_name];

                                                // Insert DB
                                                social_list.db[options.var_name] = user_data;

                                                await user_data.set(insert_data);

                                            } else {
                                                await user_data.remove();
                                            }

                                        }

                                        // Delete Database Data
                                        else if (last_data && typeof last_data[options.var_name] !== "undefined") {

                                            // Make the Action
                                            await user_data.remove();

                                        }

                                    }

                                    return;

                                };

                                // Discord
                                await build_extra_data({ database: 'discord', var_name: 'discord_id' });

                                // Google
                                await build_extra_data({ database: 'google', var_name: 'google_id' });

                                // Twitch
                                await build_extra_data({ database: 'twitch' });

                                // Twitter
                                await build_extra_data({ database: 'twitter' });

                                // Youtube
                                await build_extra_data({ database: 'youtube' });

                                // For Promise
                                const forPromise = require('for-promise');

                                // Insert Social Data
                                await forPromise({ data: social_list.data }, function (item, fn, fn_error, extra) {

                                    // Prepare Patreon Data
                                    insert_data[item] = social_list.data[item];

                                    // Add Extra FN
                                    if (social_list.data) {
                                        const extraForAwait = extra(social_list.data);
                                        extraForAwait.run(function (item2, fn, fn_error) {

                                            // Prepare Data to Insert
                                            const newData = {};
                                            newData[item] = social_list.data[item];

                                            // Try Update Data
                                            try {
                                                social_list.db[item2].update(newData).then(() => {
                                                    return fn();
                                                }).catch(err => {
                                                    return fn_error(err);
                                                });
                                            }

                                            // Fail
                                            catch (err) {
                                                fn();
                                            }

                                            // Complete
                                            return;

                                        });
                                    }

                                    // Complete
                                    return fn();

                                });

                                // Insert Full Patreon Data
                                insert_data.data = {
                                    tiers: finalData.vanilla.tiers,
                                    user: finalData.vanilla.user
                                };

                                // Set Campaign Data
                                await campaign_data.set(finalData.vanilla.campaign);

                                // Prepare Custom Module
                                const custom_module_manager = require('puddy-lib/libs/custom_module_loader');
                                const custom_module_options = {
                                    data: insert_data,
                                    db: patreon_data,
                                    social: social_list
                                };

                                // Insert Patreon Data
                                if (isInsert) {
                                    await patreon_data.set(insert_data);
                                    await custom_module_manager.run(custom_modules, custom_module_options, 'add');
                                } else {
                                    await patreon_data.remove();
                                    await custom_module_manager.run(custom_modules, custom_module_options, 'remove');
                                }

                            }

                        }

                        return http_page.send(res, 200);

                    }

                    // No Value
                    else {

                        // No Event Text
                        if (typeof last_event_item !== "string") {
                            console.error('Invalid Patreon Event Type!');
                        }

                        // Event Detected
                        else {
                            console.error(`Invalid Patreon Event Type! (${last_event_item})`);
                        }

                        // Send Error Page
                        return http_page.send(res, 200);

                    }

                }

                // Error Verify
                else {
                    console.error('The data sent was not authorized by the Secret Patreon Key!!');
                    return http_page.send(res, 401);
                }

            }

            // No Value
            else {
                console.error('Invalid Account Name Size!');
                return http_page.send(res, 411);
            }

        }

        // No Value
        else {
            console.error('Invalid Account Name!');
            return http_page.send(res, 403);
        }

    } catch (err) {

        // HTTP Page
        console.error(err);
        console.error(err.message);
        return http_page.send(res, 500);

    }

};