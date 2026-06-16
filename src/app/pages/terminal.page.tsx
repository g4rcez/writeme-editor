import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGlobalStore } from "@/store/global.store";

export default function TerminalPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const [, dispatch] = useGlobalStore();
	const navigate = useNavigate();

	useEffect(() => {
		if (!sessionId) {
			navigate("/", { replace: true });
			return;
		}

		void dispatch.addTerminalTab(sessionId);
	}, [dispatch, navigate, sessionId]);

	return null;
}
