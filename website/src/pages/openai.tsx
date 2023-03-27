import React from "react";
import Layout from "@theme/Layout";

import { Hero } from "../partials/general/Hero";
import { AutofillFeature } from "../partials/data_enhancement/AutofillFeature";
// import { NLPIntegration } from "../partials/data_enhancement/NLPIntegration";
// import { CustomizationOptions } from "../partials/data_enhancement/CustomizationOptions";
// import { Testimonials } from "../partials/data_enhancement/Testimonials";
// import { Contact } from "../partials/data_enhancement/Contact";
import { CTAButtonMixin } from "../partials/utils";
import {
    DataEnhancementUseCases
} from "../partials/data_enhancement/DataEnhancementUseCases";
import { TwoColumns } from "../partials/general/TwoColumns";
import {
    DataEnhancementHero
} from "../partials/data_enhancement/DataEnhancementHero";

function DataEnhancement() {

    return (
        <Layout
            title="CMS with OpenAI Integration | Autofill Feature | Natural Language Processing | Customization Options">

            <DataEnhancementHero/>

            <DataEnhancementUseCases/>
            <AutofillFeature/>
            {/*<NLPIntegration />*/}
            {/*<CustomizationOptions />*/}
            {/*<Testimonials />*/}
            {/*<Contact />*/}
        </Layout>
    );
}

export default DataEnhancement;
