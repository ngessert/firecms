import React from "react";

import Layout from "@theme/Layout";
import { Hero } from "../partials/general/Hero";
import { VersionsComparison } from "../partials/pricing/VersionsComparison";
import { CLIInstructions } from "../partials/pricing/CLIInstructions";
import { FireCMSCloudVersions } from "../partials/pricing/FireCMSCloudVersions";

function FeaturesPage() {

    return (
        <Layout
            title={"Pricing - FireCMS"}
            description="Free self-hosted version and free Cloud tier, adaptive pricing for everyone">

            <Hero
                color={"primary"}
                title={
                    <>
                        <span className="block lg:inline">Pricing</span>
                    </>}
                subtitle={
                    <>
                        <p>Experience the power of our CMS platform with a
                            free, <b>self-hosted</b> option or try <b>FireCMS
                                Cloud</b> for a fully-managed, full-service solution.
                        </p>
                    </>}
                // cta={<a
                //     href="mailto:hello@firecms.co?subject=FireCMS%20consulting"
                //     rel="noopener noreferrer"
                //     target="_blank"
                //     className={CTAButtonMixin}>
                //     Get in touch
                // </a>}
            />

            {/*<VersionsToggle value={version} onSelect={setVersion}/>*/}

            <FireCMSCloudVersions/>

            <VersionsComparison/>

            <CLIInstructions/>

        </Layout>
    );
}

export default FeaturesPage;

