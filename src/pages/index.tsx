import S3 from 'aws-sdk/clients/s3';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import { useCallback, useRef, useState } from 'react';
import Edit from '../components/edit';
import { ErrorDialog } from '../components/error';
import { ShareLinkDialog } from '../components/home/ShareLinkDialog';
import Malleable, { FieldEdit } from '../components/malleable';
import Snapshot from '../components/snapshot';
import { useScrollReset } from '../hooks/use-scroll-reset';
import layoutStyles from '../styles/layout.module.css';

// Next.js automatically eliminates code used for `getStaticProps`!
// This code (and the `aws-sdk` import) will be absent from the final client-
// side JavaScript bundle(s).
const s3 = new S3({
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

export const getStaticProps: GetStaticProps = async ({
  // `preview` is a Boolean, specifying whether or not the application is in
  // "Preview Mode":
  preview,
  // `previewData` is only set when `preview` is `true`, and contains whatever
  // user-specific data was set in `res.setPreviewData`. See the API endpoint
  // that enters "Preview Mode" for more info (api/share/[snapshotId].tsx).
  previewData,
}) => {
  if (preview) {
    const { snapshotId } = previewData as { snapshotId: string };
    try {
      // In preview mode, we want to access the stored data from AWS S3.
      // Imagine using this to fetch draft CMS state, etc.
      const object = await s3
        .getObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: `${snapshotId}.json`,
        })
        .promise();

      const contents = JSON.parse(object.Body.toString());
      return {
        props: { isPreview: true, snapshotId, contents },
      };
    } catch (e) {
      return {
        props: {
          isPreview: false,
          hasError: true,
          message:
            // 403 implies 404 in this case, as our IAM user has access to all
            // objects, but the bucket itself is private.
            e.statusCode === 403
              ? 'The requested preview edit does not exist!'
              : 'An error has occurred while connecting to S3. Please refresh the page to try again.',
        },
      };
    }
  }
  return { props: { isPreview: false } };
};

export default function Home(props) {
  // Scroll to top on mount as to ensure the user sees the "Preview Mode" bar
  useScrollReset();

  const [currentSnapshotId, setSnapshotId] = useState(null);
  const clearSnapshot = useCallback(() => setSnapshotId(null), [setSnapshotId]);

  const [isEdit, setEdit] = useState(false);
  const toggleEdit = useCallback(() => setEdit(!isEdit), [isEdit]);

  // Prevent duplication before re-render
  const hasSaveRequest = useRef(false);
  const [isSharingView, _setSharing] = useState(false);
  const setSharing = useCallback(
    (sharing: boolean) => {
      hasSaveRequest.current = sharing;
      _setSharing(sharing);
    },
    [hasSaveRequest, _setSharing]
  );

  const [currentError, setError] = useState<Error>(null);
  const onClearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const share = useCallback(() => {
    if (hasSaveRequest.current) return;
    setSharing(true);

    const els = document.querySelectorAll('[id] > [contenteditable=true]');
    const persistContents: FieldEdit[] = [].slice
      .call(els)
      .map(({ parentNode: { id }, innerText }) => ({ id, innerText }));

    self
      .fetch(`/api/save`, {
        method: 'POST',
        body: JSON.stringify(persistContents),
        headers: { 'content-type': 'application/json' },
      })
      .then((res) => {
        if (res.ok) return res.json();
        return new Promise(async (_, reject) =>
          reject(new Error(await res.text()))
        );
      })
      .then(({ snapshotId }) => {
        setSnapshotId(snapshotId);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setSharing(false);
      });
  }, []);

  const edits = props.isPreview ? props.contents : [];
  return (
    <>
      <Head>
        <title>Next.js | Preview Mode</title>
        <meta
          name="description"
          content="This website demonstrates a static website generated using Next.js' new Static Site Generation (SSG)."
        ></meta>
      </Head>
      {currentError && (
        <ErrorDialog onExit={onClearError}>
          <p>
            An error occurred while saving your snapshot. Please try again in a
            bit.
          </p>
          <pre>{currentError.message}</pre>
        </ErrorDialog>
      )}
      {currentSnapshotId && (
        <ShareLinkDialog
          snapshotId={currentSnapshotId}
          onExit={clearSnapshot}
        />
      )}
      <div className={layoutStyles.layout}>
        {(props.isPreview || props.hasError) && (
          <aside role="alert">
            <a href="/api/exit">Preview Mode</a>
          </aside>
        )}
        {props.hasError ? (
          <>
            <h1>Oops</h1>
            <h2>Something unique to your preview went wrong.</h2>
            <div className="explanation" style={{ textAlign: 'center' }}>
              <p>
                The production website is <strong>still available</strong> and
                this does not affect other users.
              </p>
            </div>
            <hr />
            <h2>Reason</h2>
            <div className="explanation" style={{ textAlign: 'center' }}>
              <p>{props.message}</p>
            </div>
          </>
        ) : (
          <Content isEdit={isEdit} edits={edits} />
        )}
      </div>
      {isEdit ? (
        <>
          <Snapshot
            onCancel={toggleEdit}
            onShare={share}
            isSharing={isSharingView}
          />
        </>
      ) : (
        <Edit onClick={toggleEdit} />
      )}
    </>
  );
}

function Content({ isEdit, edits }: { isEdit: boolean; edits: FieldEdit[] }) {
  return (
    <>
      <Malleable id="title" as="h1" isActive={isEdit} edits={edits}>
        CSE Skills Assessment
      </Malleable>
      <div className="features">
        <div className="feature">
          <Malleable
            id="feature-1-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            ⚡
          </Malleable>
          <Malleable
            id="feature-1-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Blazing fast
          </Malleable>
        </div>
        <div className="feature">
          <Malleable
            id="feature-2-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            📡
          </Malleable>
          <Malleable
            id="feature-2-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Always available
          </Malleable>
        </div>
        <div className="feature">
          <Malleable
            id="feature-3-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            🏎
          </Malleable>
          <Malleable
            id="feature-3-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Lighthouse 100
          </Malleable>
        </div>
      </div>
      <div className="explanation">
        <div className="p">
          <Malleable as="h2" id="title-2" isActive={isEdit} edits={edits}>
          From this list, rank your 5 most favourite and 5 least favourite support tasks. Provide a brief explanation for each. <br />
          </Malleable>
          
          <Malleable
            id="explanation-1-inspect"
            as="span"
            isActive={isEdit}
            edits={edits}
          >
            Five most favourite support tasks:<br />
            1. Write and maintain support articles and docs pages: Maintaining the support articles and docs pages is crucial for the customer support role as it promotes three important things, efficiency, sharing of knowledge, and continuous improvement.<br /> 
            2. Identify, file (and, where possible, resolve) bugs in private and public Vercel/Next.js repos on GitHub: Improve my technical proficiency and problem-solving skills<br />
            3.  Help train and onboard new support teammates: It is a two-way kind of learning, not only the new onboarded teammates are benefitting but also the person who is doing the training as it enhances many skills <br />
            4. Work with the product team to develop a new feature based on feedback from customers: Enhance skills such as collaboration, business requirement analysis, different project management methodologies<br />
            5. Analyze hundreds of support tickets to spot trends the product team can use: Enhance understanding in various customer support requests<br />
            
            Five least favourite support tasks: <br />
            1. Manage a support team: Focus on increasing my knowledge in the technicalities <br />
            2. Respond to 50+ support requests via email every day: Having to respond quickly could be overwhelming<br />
            3. Dig through logs to troubleshoot a customer's broken project: Can be time-consuming and challenging. Most of the time it requires high-level technical expertise<br />
            4. Work with 3rd party partners to track down a tricky situation for a joint customer: the lack of direct control over external parties<br />
            5. Engage multiple users at once in a public discussion, to answer their questions and troubleshoot problems: Can be challenging to balance the needs of different users <br />
            
          </Malleable>
          <br />
        </div>
          <div className="explanation">
        <div className="p">
          <Malleable as="h2" id="title-2" isActive={isEdit} edits={edits}>
          What do you want to learn or do more of at work? <br />
          </Malleable>
          
          <Malleable
            id="explanation-1-inspect"
            as="span"
            isActive={isEdit}
            edits={edits}
          >
            Technical skills<br />
            Specifically in the fields of modern web architecture. I have been involved working in SaaS platform and I really find it interesting on how the web architecture works. <br />
            Being involved in understanding the frontend frameworks like Next.js and React, cloud technologies, serverless computing and DNS would really be a good opportunity for me to dive in. <br />
            Strengthening my technical expertise will enable me to contribute more effectively to projects and problem-solving initiatives.<br />
            
            Communication Skills <br />
           I would also like to further improve my communication skills. <br />
           It is crucial being a CSE, this includes relaying complex ideas effectively to the team and other stakeholders. <br />
      
          </Malleable>
          <br />
        </div>
         <div className="p">
          <Malleable as="h2" id="title-2" isActive={isEdit} edits={edits}>
          Imagine a customer writes in requesting help with a build issue on a framework or technology that you've not seen before. <br />
          How would you begin troubleshooting this and what questions would you ask the customer to understand the situation better? <br />
          </Malleable>
          
          <Malleable
            id="explanation-1-inspect"
            as="span"
            isActive={isEdit}
            edits={edits}
          >
            In the customer support world, there will be scenarios where we face an issue which we are unfamiliar with. <br />
            In these cases, when I encounter a customer seeking assistance with a build issue on a framework or technology that I'm unfamiliar with, <br />
            I would approach the situation systematically to gather relevant information and eventually find out a solution for troubleshooting. <br />
            Firstly, I would conduct initial research to gain an understanding of the framework or technology.  <br />
            I will look for documentations or help file that could provide insights on the specific issue, or I would read through some forums or community resources. <br />
            I will also look for tutorials or guides related that could add to my knowledge. <br />
            Next step would be asking the customer to provide me more context of the issue like a detailed information about the specific build issue they are encountering.  <br />
            I will ask them to provide any evidence of the issue which would help me replicate it. I would request for any error messages or log issues,  <br />
            if there were code recent code changes in their development environment, if there are dependencies in other configurations and any other third-party vendors.  <br />
            After getting the information by the customer, I would try to explore potential solutions with the issue.<br /> 
            This might involve troubleshooting common issues, experimenting with different configurations or even seeking assistance on any third-party vendors that would have greater knowledge.  <br />
          
      
          </Malleable>
          <br />
        </div>
        <Malleable id="explanation-2" isActive={isEdit} edits={edits}>
          When people visit this site, the response always comes instantly from
          their{' '}
          <a
            target="_blank"
            rel="noopener"
            href="https://vercel.com/docs/concepts/edge-network/overview"
          >
            nearest location
          </a>
          .
        </Malleable>
        <Malleable id="explanation-3" isActive={isEdit} edits={edits}>
          Unlike traditional static solutions, however, you can generate
          previews of edits that you can share with anyone you choose. To try it
          out, click the edit icon on the bottom right and edit the content.
          When you're done, click the share icon on the bottom right to generate
          a shareable preview URL.
        </Malleable>
        <Malleable id="explanation-4" isActive={isEdit} edits={edits}>
          SSG and Preview Mode make Next.js the most optimal framework to
          integrate into your Headless CMS workflow. Learn more about the
          preview mode on{' '}
          <a
            target="_blank"
            rel="noopener"
            href="https://nextjs.org/docs/advanced-features/preview-mode"
          >
            our documentation.
          </a>
        </Malleable>
      </div>
    </>
  );
}
